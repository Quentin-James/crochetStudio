import { newId } from './ids'
import type { Id, Pattern, PatternRow, PatternSection, YarnColor, YarnSettings } from './types'

/**
 * The project colour palette.
 *
 * A project has one main colour plus any number of named palette colours.
 * Sections and rows point at a palette entry by id, which is what makes stripes
 * and colour blocks possible: the 3D model reads the same resolution, so what is
 * assigned in the pattern is what appears on the model.
 */

/** Starting suggestions, drawn from the studio palette plus a few warm neighbours. */
export const COLOR_SUGGESTIONS = [
  '#D9B6B0',
  '#C49B94',
  '#E5D5C3',
  '#F1E8DC',
  '#8B7464',
  '#44382F',
  '#A3A98F',
  '#7D8B7A',
  '#B98F87',
  '#E8C9A0',
  '#9E8CA8',
  '#6F7F96',
] as const

/** Palette of a project, tolerating documents written before palettes existed. */
export const paletteOf = (yarn: YarnSettings): YarnColor[] => yarn.palette ?? []

export function findColor(yarn: YarnSettings, id: Id | null): YarnColor | null {
  if (id === null) return null
  return paletteOf(yarn).find((entry) => entry.id === id) ?? null
}

/**
 * The colour a row is actually worked in: its own, else its section's, else the
 * main yarn colour. A deleted palette entry falls back the same way rather than
 * rendering as nothing.
 */
export function resolveRowColor(
  yarn: YarnSettings,
  section: Pick<PatternSection, 'colorId'>,
  row: Pick<PatternRow, 'colorId'>,
): string {
  return (
    findColor(yarn, row.colorId)?.color ??
    findColor(yarn, section.colorId)?.color ??
    yarn.color
  )
}

export function resolveSectionColor(
  yarn: YarnSettings,
  section: Pick<PatternSection, 'colorId'>,
): string {
  return findColor(yarn, section.colorId)?.color ?? yarn.color
}

/**
 * The colour of one stitch: its own, then its row's, then its section's, then
 * the main yarn. This single order is what makes the chart, the written pattern
 * and the 3D model agree.
 */
export function resolveStitchColor(
  yarn: YarnSettings,
  section: Pick<PatternSection, 'colorId'>,
  row: Pick<PatternRow, 'colorId' | 'stitchColors'>,
  stitchIndex: number,
): string {
  const own = row.stitchColors?.[stitchIndex]
  return findColor(yarn, own ?? null)?.color ?? resolveRowColor(yarn, section, row)
}

/** Resolved colour of every stitch in a row, or null when the row is plain. */
export function rowStitchColors(
  yarn: YarnSettings,
  section: Pick<PatternSection, 'colorId'>,
  row: Pick<PatternRow, 'colorId' | 'stitchColors' | 'stitchCount'>,
): string[] | null {
  if (!row.stitchColors || Object.keys(row.stitchColors).length === 0) return null

  const base = resolveRowColor(yarn, section, row)
  return Array.from({ length: row.stitchCount }, (_unused, index) => {
    const own = row.stitchColors?.[index]
    return findColor(yarn, own ?? null)?.color ?? base
  })
}

export interface StitchEdit {
  rowId: Id
  stitchIndex: number
}

/**
 * Paints individual stitches.
 *
 * Takes a batch because that is how a chart is used — a drag across the grid is
 * one edit, not forty. Setting a stitch back to the row colour removes the entry
 * rather than storing a null, so a cleared chart costs nothing.
 */
export function paintStitches(
  pattern: Pattern,
  sectionId: Id,
  edits: readonly StitchEdit[],
  colorId: Id | null,
): Pattern {
  if (edits.length === 0) return pattern

  const byRow = new Map<Id, number[]>()
  for (const edit of edits) {
    const list = byRow.get(edit.rowId)
    if (list) list.push(edit.stitchIndex)
    else byRow.set(edit.rowId, [edit.stitchIndex])
  }

  return {
    ...pattern,
    sections: pattern.sections.map((section) => {
      if (section.id !== sectionId) return section

      return {
        ...section,
        rows: section.rows.map((row) => {
          const indices = byRow.get(row.id)
          if (!indices) return row

          const next: Record<number, Id> = { ...(row.stitchColors ?? {}) }
          for (const index of indices) {
            if (index < 0 || index >= row.stitchCount) continue
            if (colorId === null) delete next[index]
            else next[index] = colorId
          }

          return {
            ...row,
            stitchColors: Object.keys(next).length === 0 ? null : next,
          }
        }),
      }
    }),
  }
}

/** Clears every per-stitch colour in a section, leaving the row colours alone. */
export function clearStitchColors(pattern: Pattern, sectionId: Id): Pattern {
  return {
    ...pattern,
    sections: pattern.sections.map((section) =>
      section.id === sectionId
        ? { ...section, rows: section.rows.map((row) => ({ ...row, stitchColors: null })) }
        : section,
    ),
  }
}

/** How many stitches carry their own colour — shown honestly in the UI. */
export function paintedStitchCount(pattern: Pattern): number {
  return pattern.sections.reduce(
    (total, section) =>
      total +
      section.rows.reduce(
        (rowTotal, row) => rowTotal + Object.keys(row.stitchColors ?? {}).length,
        0,
      ),
    0,
  )
}

/** Adds a colour and returns the new yarn settings plus the id that was created. */
export function addColor(
  yarn: YarnSettings,
  color: string,
  label?: string,
): { yarn: YarnSettings; id: Id } {
  const palette = paletteOf(yarn)
  const entry: YarnColor = {
    id: newId(),
    label: label?.trim() || `Couleur ${palette.length + 1}`,
    color,
  }
  return { yarn: { ...yarn, palette: [...palette, entry] }, id: entry.id }
}

export function updateColor(
  yarn: YarnSettings,
  id: Id,
  patch: Partial<Omit<YarnColor, 'id'>>,
): YarnSettings {
  return {
    ...yarn,
    palette: paletteOf(yarn).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  }
}

export function removeColor(yarn: YarnSettings, id: Id): YarnSettings {
  return { ...yarn, palette: paletteOf(yarn).filter((entry) => entry.id !== id) }
}

/**
 * Drops every reference to a colour.
 *
 * Called when a palette entry is deleted so no section or row is left pointing
 * at something that no longer exists.
 */
export function clearColorReferences(pattern: Pattern, id: Id): Pattern {
  return {
    ...pattern,
    sections: pattern.sections.map((section) => ({
      ...section,
      colorId: section.colorId === id ? null : section.colorId,
      rows: section.rows.map((row) => (row.colorId === id ? { ...row, colorId: null } : row)),
    })),
  }
}

/** Assigns a colour to a whole section. */
export function paintSection(pattern: Pattern, sectionId: Id, colorId: Id | null): Pattern {
  return {
    ...pattern,
    sections: pattern.sections.map((section) =>
      section.id === sectionId ? { ...section, colorId } : section,
    ),
  }
}

/** Assigns a colour to one row. */
export function paintRow(
  pattern: Pattern,
  sectionId: Id,
  rowId: Id,
  colorId: Id | null,
): Pattern {
  return {
    ...pattern,
    sections: pattern.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            rows: section.rows.map((row) => (row.id === rowId ? { ...row, colorId } : row)),
          }
        : section,
    ),
  }
}

export interface StripeOptions {
  sectionId: Id
  colorId: Id | null
  /** 1-based, inclusive. */
  fromRow: number
  toRow: number
  /** Paint one row then skip `every - 1`. 1 paints every row in the range. */
  every: number
  /** How many consecutive rows each stripe covers. */
  width: number
}

/**
 * Paints stripes across a range.
 *
 * `every: 6, width: 2` means two rows of colour, four without, repeating — which
 * is how a striped pattern is actually written.
 */
export function paintStripes(pattern: Pattern, options: StripeOptions): Pattern {
  const { sectionId, colorId, fromRow, toRow, every, width } = options
  const period = Math.max(1, Math.round(every))
  const band = Math.max(1, Math.min(period, Math.round(width)))

  return {
    ...pattern,
    sections: pattern.sections.map((section) => {
      if (section.id !== sectionId) return section

      return {
        ...section,
        rows: section.rows.map((row) => {
          if (row.index < fromRow || row.index > toRow) return row
          const offset = (row.index - fromRow) % period
          return offset < band ? { ...row, colorId } : row
        }),
      }
    }),
  }
}

/** Colours actually used by the pattern, for the legend and the yarn estimate. */
export function colorsInUse(yarn: YarnSettings, pattern: Pattern): YarnColor[] {
  const used = new Set<Id>()
  for (const section of pattern.sections) {
    if (section.colorId) used.add(section.colorId)
    for (const row of section.rows) {
      if (row.colorId) used.add(row.colorId)
    }
  }
  return paletteOf(yarn).filter((entry) => used.has(entry.id))
}
