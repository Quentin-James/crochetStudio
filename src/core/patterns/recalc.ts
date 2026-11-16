import type { Derivation, Pattern, PatternRow, PatternSection } from '../types'
import { generatePattern, type GenerateInput } from './generators'
import { refreshInstruction, renumber } from './rows'

/**
 * Recalculation after a dimension, gauge or size change.
 *
 * The rule the whole application depends on: **a change in measurements may
 * never silently discard the user's own work.** So recalculation regenerates the
 * derived rows, keeps every row the user has edited (`locked`), keeps every
 * section they created by hand, and reports a conflict whenever a kept row no
 * longer agrees with the new geometry. Resolving the conflict is the user's
 * decision, not ours.
 */

export type ConflictKind =
  /** A locked row's stitch count no longer matches the calculated one. */
  | 'lockedRowDiffers'
  /** A locked row sits beyond the end of the recalculated section. */
  | 'lockedRowBeyondEnd'
  /** A section containing locked rows is no longer generated at all. */
  | 'sectionNoLongerGenerated'

export interface PatternConflict {
  kind: ConflictKind
  sectionName: string
  rowIndex: number | null
  message: string
  keptStitchCount: number | null
  calculatedStitchCount: number | null
}

export interface RecalcResult {
  pattern: Pattern
  conflicts: PatternConflict[]
  /** Rows kept exactly as the user left them. */
  preservedRows: number
  /** Rows rewritten from the new measurements. */
  recalculatedRows: number
  derivations: Derivation[]
  warnings: string[]
}

export function recalculatePattern(current: Pattern, input: GenerateInput): RecalcResult {
  const generated = generatePattern({
    ...input,
    repeat: input.repeat ?? current.repeat,
    edgeStitches: input.edgeStitches ?? current.edgeStitches,
    minStitches: input.minStitches ?? current.minStitches,
    shapingStep: input.shapingStep ?? current.shapingStep,
  })

  const conflicts: PatternConflict[] = []
  let preservedRows = 0
  let recalculatedRows = 0

  const currentGenerated = current.sections.filter((section) => section.generatedBy !== null)
  const currentManual = current.sections.filter((section) => section.generatedBy === null)
  const consumed = new Set<string>()

  const sections: PatternSection[] = generated.pattern.sections.map((fresh) => {
    const previous = matchSection(currentGenerated, fresh)
    if (!previous) return fresh
    consumed.add(previous.id)

    const rows: PatternRow[] = fresh.rows.map((freshRow, position) => {
      const previousRow = previous.rows[position]
      if (!previousRow) {
        recalculatedRows += 1
        return freshRow
      }

      if (previousRow.locked) {
        preservedRows += 1
        if (previousRow.stitchCount !== freshRow.stitchCount) {
          conflicts.push({
            kind: 'lockedRowDiffers',
            sectionName: fresh.name,
            rowIndex: previousRow.index,
            message:
              `${fresh.name}, rang ${previousRow.index} : vous avez fixé ${previousRow.stitchCount} mailles, ` +
              `le calcul en demande ${freshRow.stitchCount}. Le rang a été conservé tel quel.`,
            keptStitchCount: previousRow.stitchCount,
            calculatedStitchCount: freshRow.stitchCount,
          })
        }
        return previousRow
      }

      recalculatedRows += 1
      // Notes and colour placement are the user's content, not derived values:
      // a recalculated row keeps both.
      return refreshInstruction({
        ...freshRow,
        id: previousRow.id,
        note: previousRow.note,
        colorId: previousRow.colorId,
      })
    })

    // Locked rows past the new end are kept rather than deleted, and flagged.
    const extras = previous.rows.slice(fresh.rows.length).filter((row) => row.locked)
    for (const extra of extras) {
      preservedRows += 1
      conflicts.push({
        kind: 'lockedRowBeyondEnd',
        sectionName: fresh.name,
        rowIndex: extra.index,
        message:
          `${fresh.name}, rang ${extra.index} : les nouvelles mesures ne demandent plus que ` +
          `${fresh.rows.length} rangs. Ce rang modifié à la main a été conservé à la fin.`,
        keptStitchCount: extra.stitchCount,
        calculatedStitchCount: null,
      })
    }

    return {
      ...fresh,
      id: previous.id,
      notes: previous.notes === '' ? fresh.notes : previous.notes,
      colorId: previous.colorId,
      rows: renumber([...rows, ...extras]),
    }
  })

  // Generated sections that disappeared: kept only if they hold the user's edits.
  for (const orphan of currentGenerated) {
    if (consumed.has(orphan.id)) continue
    const locked = orphan.rows.filter((row) => row.locked)
    if (locked.length === 0) continue

    preservedRows += locked.length
    conflicts.push({
      kind: 'sectionNoLongerGenerated',
      sectionName: orphan.name,
      rowIndex: null,
      message:
        `La section « ${orphan.name} » n’est plus générée par ces mesures, mais elle contient ` +
        `${locked.length} rang(s) modifié(s) à la main. Elle a été conservée.`,
      keptStitchCount: null,
      calculatedStitchCount: null,
    })
    sections.push({ ...orphan, rows: renumber(locked) })
  }

  return {
    pattern: {
      ...generated.pattern,
      sections: [...sections, ...currentManual],
    },
    conflicts,
    preservedRows,
    recalculatedRows,
    derivations: generated.derivations,
    warnings: generated.warnings,
  }
}

/**
 * Pairs a freshly generated section with the one it replaces.
 *
 * `generatedBy` is the stable identity (e.g. `dress/skirt`); the name is only a
 * fallback for documents written before a generator was renamed.
 */
function matchSection(
  candidates: readonly PatternSection[],
  fresh: PatternSection,
): PatternSection | undefined {
  return (
    candidates.find((section) => section.generatedBy === fresh.generatedBy) ??
    candidates.find((section) => section.name === fresh.name)
  )
}
