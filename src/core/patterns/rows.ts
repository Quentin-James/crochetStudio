import { newId } from '../ids'
import { STITCHES } from '../stitches'
import type {
  Pattern,
  PatternRow,
  PatternSection,
  RowShaping,
  StitchId,
  WorkDirection,
} from '../types'

/**
 * Row and section helpers.
 *
 * Written instructions are produced here so a generated row and a hand-added row
 * are phrased identically, and so renumbering after an insert or delete happens
 * in one place.
 */

export interface NewRowInput {
  index: number
  stitch: StitchId
  stitchCount: number
  shaping?: RowShaping
  note?: string
  locked?: boolean
  /** Overrides the generated wording. */
  instruction?: string
  /** Palette colour, for stripes. */
  colorId?: string | null
}

export const EVEN: RowShaping = { kind: 'even', delta: 0 }

export function createRow(input: NewRowInput): PatternRow {
  const shaping = input.shaping ?? EVEN
  return {
    id: newId(),
    index: input.index,
    stitch: input.stitch,
    stitchCount: input.stitchCount,
    shaping,
    instruction: input.instruction ?? describeRow(input.stitchCount, input.stitch, shaping),
    note: input.note ?? '',
    locked: input.locked ?? false,
    colorId: input.colorId ?? null,
    stitchColors: null,
  }
}

export function createSection(
  name: string,
  direction: WorkDirection,
  rows: PatternRow[],
  options: { notes?: string; generatedBy?: string; colorId?: string | null } = {},
): PatternSection {
  return {
    id: newId(),
    name,
    direction,
    rows,
    notes: options.notes ?? '',
    generatedBy: options.generatedBy ?? null,
    colorId: options.colorId ?? null,
  }
}

/** French written instruction for one row, e.g. "80 br (80 m)". */
export function describeRow(
  stitchCount: number,
  stitch: StitchId,
  shaping: RowShaping,
): string {
  const abbreviation = STITCHES[stitch].abbreviation
  const total = `${stitchCount} m`

  if (shaping.kind === 'even' || shaping.delta === 0) {
    return `${stitchCount} ${abbreviation} (${total})`
  }

  const amount = Math.abs(shaping.delta)
  if (shaping.delta > 0) {
    return `${stitchCount - amount} ${abbreviation} en répartissant ${amount} augmentation${
      amount > 1 ? 's' : ''
    } (${total})`
  }

  return `${stitchCount} ${abbreviation} en répartissant ${amount} diminution${
    amount > 1 ? 's' : ''
  } (${total})`
}

/** Rebuilds the instruction unless the user has taken the row over. */
export function refreshInstruction(row: PatternRow): PatternRow {
  if (row.locked) return row
  return { ...row, instruction: describeRow(row.stitchCount, row.stitch, row.shaping) }
}

/** Renumbers rows 1..n after an insertion, deletion or reorder. */
export function renumber(rows: PatternRow[]): PatternRow[] {
  return rows.map((row, position) => (row.index === position + 1 ? row : { ...row, index: position + 1 }))
}

export function totalRows(pattern: Pattern): number {
  return pattern.sections.reduce((sum, section) => sum + section.rows.length, 0)
}

export function totalStitches(pattern: Pattern): number {
  return pattern.sections.reduce(
    (sum, section) => sum + section.rows.reduce((rowSum, row) => rowSum + row.stitchCount, 0),
    0,
  )
}

/**
 * Estimated yarn length in metres.
 *
 * One stitch consumes roughly `yarnRatio` times the length a single crochet
 * uses, and a single crochet uses about four times the hook diameter of yarn.
 * It is an estimate and the UI says so — but it is computed from the project's
 * own gauge and hook rather than invented.
 */
export function estimateYarnMetres(pattern: Pattern, hookSizeMm: number): number {
  const millimetres = pattern.sections.reduce(
    (sum, section) =>
      sum +
      section.rows.reduce(
        (rowSum, row) => rowSum + row.stitchCount * STITCHES[row.stitch].yarnRatio * hookSizeMm * 4,
        0,
      ),
    0,
  )
  return millimetres / 1000
}

/**
 * A structural fingerprint of a pattern, ignoring ids, notes and wording.
 *
 * Used to tell whether a recalculation would actually change anything, so the
 * studio can say "your pattern no longer matches these measurements" without
 * comparing object identities that change on every generation.
 */
export function patternSignature(pattern: Pattern): string {
  return JSON.stringify([
    pattern.repeat,
    pattern.edgeStitches,
    pattern.sections.map((section) => [
      section.name,
      section.direction,
      section.generatedBy,
      section.rows.map((row) => [row.stitch, row.stitchCount, row.shaping.delta]),
    ]),
  ])
}

/** The global row number of a row, counting across sections, 1-based. */
export function globalRowNumber(pattern: Pattern, sectionId: string, rowIndex: number): number {
  let offset = 0
  for (const section of pattern.sections) {
    if (section.id === sectionId) return offset + rowIndex
    offset += section.rows.length
  }
  return offset + rowIndex
}
