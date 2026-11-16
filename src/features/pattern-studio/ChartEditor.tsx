import { useEffect, useMemo, useRef, useState } from 'react'
import { findColor, resolveRowColor, type StitchEdit } from '../../core/colors'
import type { PatternSection, YarnSettings } from '../../core/types'
import { Button, Icon } from '../../design/components'
import './ChartEditor.css'

interface ChartEditorProps {
  section: PatternSection
  yarn: YarnSettings
  /** The palette colour armed for painting; null paints "back to the row colour". */
  selectedColorId: string | null
  onPaint: (edits: StitchEdit[], colorId: string | null) => void
}

const MIN_CELL = 6
const MAX_CELL = 28

/**
 * The colourwork chart.
 *
 * One cell per stitch, row 1 at the bottom as a crochet chart is read. Drawn on
 * a canvas because a dress is 20 000 cells and that many DOM nodes would make
 * the browser crawl.
 *
 * A drag is one edit: cells are painted onto the canvas immediately so the
 * gesture feels direct, and the whole batch is committed to the pattern when the
 * pointer lifts — one undoable change, one write, instead of forty.
 */
export function ChartEditor({ section, yarn, selectedColorId, onPaint }: ChartEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paintingRef = useRef(false)
  const pendingRef = useRef(new Map<string, StitchEdit>())

  const [cell, setCell] = useState(14)

  const widestRow = useMemo(
    () => section.rows.reduce((max, row) => Math.max(max, row.stitchCount), 0),
    [section.rows],
  )

  const rows = section.rows
  const width = Math.max(1, widestRow) * cell
  const height = Math.max(1, rows.length) * cell

  /** Draws the whole chart from the pattern. */
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    context.clearRect(0, 0, width, height)

    rows.forEach((row, rowIndex) => {
      // Row 1 sits at the bottom, the way a chart is read.
      const y = (rows.length - 1 - rowIndex) * cell
      const base = resolveRowColor(yarn, section, row)

      for (let stitch = 0; stitch < row.stitchCount; stitch += 1) {
        const own = row.stitchColors?.[stitch]
        context.fillStyle = findColor(yarn, own ?? null)?.color ?? base
        context.fillRect(stitch * cell, y, cell, cell)
      }

      // A gap where a row is narrower than the widest one, so decreases show.
      if (row.stitchCount < widestRow) {
        context.fillStyle = 'rgba(68, 56, 47, 0.06)'
        context.fillRect(row.stitchCount * cell, y, (widestRow - row.stitchCount) * cell, cell)
      }
    })

    // Grid lines only when the cells are big enough for them to help.
    if (cell >= 9) {
      context.strokeStyle = 'rgba(68, 56, 47, 0.18)'
      context.lineWidth = 1
      context.beginPath()
      for (let x = 0; x <= widestRow; x += 1) {
        const line = Math.round(x * cell) + 0.5
        context.moveTo(line, 0)
        context.lineTo(line, height)
      }
      for (let y = 0; y <= rows.length; y += 1) {
        const line = Math.round(y * cell) + 0.5
        context.moveTo(0, line)
        context.lineTo(width, line)
      }
      context.stroke()
    }

    // Every tenth stitch and fifth row, a heavier line: counting aid.
    context.strokeStyle = 'rgba(68, 56, 47, 0.38)'
    context.lineWidth = 1.5
    context.beginPath()
    for (let x = 10; x < widestRow; x += 10) {
      const line = Math.round(x * cell) + 0.5
      context.moveTo(line, 0)
      context.lineTo(line, height)
    }
    for (let y = 5; y < rows.length; y += 5) {
      const line = Math.round((rows.length - y) * cell) + 0.5
      context.moveTo(0, line)
      context.lineTo(width, line)
    }
    context.stroke()
  }, [cell, height, rows, section, widestRow, width, yarn])

  /** Which cell a pointer is over, or null when it is past the end of a row. */
  const cellAt = (event: React.PointerEvent<HTMLCanvasElement>): StitchEdit | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const bounds = canvas.getBoundingClientRect()
    const stitch = Math.floor((event.clientX - bounds.left) / cell)
    const fromTop = Math.floor((event.clientY - bounds.top) / cell)
    const rowIndex = rows.length - 1 - fromTop

    const row = rows[rowIndex]
    if (!row || stitch < 0 || stitch >= row.stitchCount) return null

    return { rowId: row.id, stitchIndex: stitch }
  }

  /** Paints one cell on the canvas straight away, so the drag feels immediate. */
  const previewCell = (edit: StitchEdit) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!context) return

    const rowIndex = rows.findIndex((row) => row.id === edit.rowId)
    if (rowIndex < 0) return

    const row = rows[rowIndex]
    if (!row) return

    const y = (rows.length - 1 - rowIndex) * cell
    context.fillStyle =
      findColor(yarn, selectedColorId)?.color ?? resolveRowColor(yarn, section, row)
    context.fillRect(edit.stitchIndex * cell, y, cell, cell)
  }

  const add = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const edit = cellAt(event)
    if (!edit) return

    const key = `${edit.rowId}:${edit.stitchIndex}`
    if (pendingRef.current.has(key)) return

    pendingRef.current.set(key, edit)
    previewCell(edit)
  }

  const commit = () => {
    paintingRef.current = false
    const edits = [...pendingRef.current.values()]
    pendingRef.current.clear()
    if (edits.length > 0) onPaint(edits, selectedColorId)
  }

  const colorName = selectedColorId
    ? (findColor(yarn, selectedColorId)?.label ?? 'couleur')
    : 'couleur du rang'

  return (
    <div className="cs-chart">
      <div className="cs-chart__bar">
        <p className="cs-chart__brush">
          <span
            className="cs-chart__brush-swatch"
            style={{ background: findColor(yarn, selectedColorId)?.color ?? yarn.color }}
            aria-hidden="true"
          />
          Pinceau&nbsp;: <strong>{colorName}</strong>
        </p>

        <div className="cs-chart__zoom">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon="search"
            onClick={() => setCell(Math.max(MIN_CELL, cell - 3))}
          >
            Réduire les cases
          </Button>
          <span className="cs-chart__zoom-value">{cell} px</span>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon="plus"
            onClick={() => setCell(Math.min(MAX_CELL, cell + 3))}
          >
            Agrandir les cases
          </Button>
        </div>
      </div>

      <div className="cs-chart__scroll">
        <div className="cs-chart__canvas-wrap" style={{ width, height }}>
          <canvas
            ref={canvasRef}
            className="cs-chart__canvas"
            role="img"
            // An em dash rather than an article: section names are "Corsage",
            // "Jupe", "Base ovale" — no single article fits them all.
            aria-label={`Plan de couleurs — ${section.name} : ${rows.length} rangs sur ${widestRow} mailles`}
            onPointerDown={(event) => {
              // Capture keeps the drag alive if the finger leaves the canvas.
              // It is an optimisation, not a requirement: never let it stop the
              // stroke from starting.
              try {
                event.currentTarget.setPointerCapture(event.pointerId)
              } catch {
                // No pointer capture here; the stroke still works.
              }
              paintingRef.current = true
              add(event)
            }}
            onPointerMove={(event) => {
              if (paintingRef.current) add(event)
            }}
            onPointerUp={commit}
            onPointerCancel={commit}
            onPointerLeave={() => {
              if (paintingRef.current) commit()
            }}
          />
        </div>
      </div>

      <p className="cs-chart__legend">
        <Icon name="chevronRight" size={13} />
        Rang 1 en bas. Glissez pour peindre plusieurs mailles d’un coup. Choisissez « couleur
        principale » dans la palette pour effacer une maille.
      </p>
    </div>
  )
}
