import type { Derivation } from './types'

/**
 * Shaping: turning "go from 48 stitches to 96 over 30 rows" into an explicit
 * per-row schedule.
 *
 * A pattern that says "increase evenly" is not a pattern — the crocheter still
 * has to do the arithmetic. This module does it, and the schedule it returns is
 * what the row editor and the written instructions both use.
 */

export interface ShapingRow {
  /** 1-based row number within the section. */
  row: number
  /** Stitch change applied on this row; negative for a decrease. */
  delta: number
  /** Stitch count after this row. */
  total: number
}

export interface ShapingPlan {
  from: number
  to: number
  rows: number
  /** One entry per row, including the rows worked straight (delta 0). */
  schedule: ShapingRow[]
  /** Rows that actually change the count. */
  shapingRowCount: number
  derivation: Derivation
  warnings: string[]
}

export interface ShapingOptions {
  /**
   * Stitches added or removed on a single shaping row. Two is the usual choice
   * for a flat panel (one at each edge); rounds often use more.
   */
  stepPerRow?: number
  /** Keeps the first row free of shaping, which is almost always wanted. */
  skipFirstRow?: boolean
}

/**
 * Distributes the change as evenly as the row count allows.
 *
 * Spacing uses integer arithmetic rather than rounded floats, so the shaping
 * rows are spread without drift and the last one lands on or before the final row.
 */
export function distributeShaping(
  from: number,
  to: number,
  rows: number,
  options: ShapingOptions = {},
): ShapingPlan {
  const { stepPerRow = 2, skipFirstRow = true } = options
  const warnings: string[] = []

  if (rows < 1) {
    throw new Error('Le nombre de rangs doit être au moins 1.')
  }

  const totalChange = to - from
  const direction = Math.sign(totalChange)
  const magnitude = Math.abs(totalChange)

  // How many rows must carry shaping, at `stepPerRow` stitches each.
  let shapingRowCount = Math.ceil(magnitude / stepPerRow)
  const available = skipFirstRow ? rows - 1 : rows

  if (shapingRowCount > available && available > 0) {
    warnings.push(
      `Il faut ${shapingRowCount} rangs façonnés mais seuls ${available} sont disponibles : ` +
        `plusieurs façonnages sont regroupés sur le même rang, ce qui marquera la forme.`,
    )
  }

  const schedule: ShapingRow[] = []
  let total = from

  if (magnitude === 0 || available <= 0) {
    if (magnitude > 0 && available <= 0) {
      warnings.push('Trop peu de rangs pour façonner : le panneau est travaillé droit.')
    }
    for (let row = 1; row <= rows; row += 1) {
      schedule.push({ row, delta: 0, total })
    }
    return {
      from,
      to: total,
      rows,
      schedule,
      shapingRowCount: 0,
      derivation: evenDerivation(from, to, rows, total),
      warnings,
    }
  }

  // Spread `shapingRowCount` marks across `available` rows, evenly.
  const effectiveShapingRows = Math.min(shapingRowCount, available)
  const firstRow = skipFirstRow ? 2 : 1
  const marks = new Set<number>()
  for (let index = 0; index < effectiveShapingRows; index += 1) {
    // Centre each mark in its slice, so the shaping is not bunched at one end.
    const offset = Math.floor(((2 * index + 1) * available) / (2 * effectiveShapingRows))
    marks.add(firstRow + Math.min(offset, available - 1))
  }

  // Rounding can collapse two marks onto one row; fill forward to keep the count.
  while (marks.size < effectiveShapingRows) {
    for (let row = firstRow; row < firstRow + available; row += 1) {
      if (!marks.has(row)) {
        marks.add(row)
        break
      }
    }
  }

  const markedRows = [...marks].sort((a, b) => a - b)
  let remaining = magnitude
  const perRow = new Map<number, number>()

  for (const [index, row] of markedRows.entries()) {
    const rowsLeft = markedRows.length - index
    // Give each marked row its step, pushing any excess onto the last rows.
    const share = Math.min(
      Math.max(stepPerRow, Math.ceil(remaining / rowsLeft)),
      remaining,
    )
    perRow.set(row, share)
    remaining -= share
  }

  for (let row = 1; row <= rows; row += 1) {
    const change = (perRow.get(row) ?? 0) * direction
    total += change
    schedule.push({ row, delta: change, total })
  }

  shapingRowCount = markedRows.length

  const interval = Math.round(available / effectiveShapingRows)

  return {
    from,
    to: total,
    rows,
    schedule,
    shapingRowCount,
    derivation: {
      label: direction > 0 ? 'Augmentations' : 'Diminutions',
      formula:
        'nombre de rangs façonnés = |mailles d’arrivée − mailles de départ| ÷ mailles par rang façonné',
      inputs: {
        'mailles de départ': from,
        'mailles d’arrivée': to,
        'rangs disponibles': rows,
        'mailles par rang façonné': stepPerRow,
      },
      rawResult: round2(magnitude / stepPerRow),
      finalResult: shapingRowCount,
      adjustments: [
        {
          reason: `Réparti environ tous les ${Math.max(1, interval)} rangs`,
          from: shapingRowCount,
          to: shapingRowCount,
        },
      ],
    },
    warnings,
  }
}

function evenDerivation(from: number, to: number, rows: number, total: number): Derivation {
  return {
    label: 'Rangs droits',
    formula: 'aucun façonnage nécessaire',
    inputs: { 'mailles de départ': from, 'mailles d’arrivée': to, rangs: rows },
    rawResult: 0,
    finalResult: total,
    adjustments: [],
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100
