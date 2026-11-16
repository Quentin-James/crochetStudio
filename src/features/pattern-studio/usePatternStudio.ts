import { useCallback, useMemo } from 'react'
import { paintRow, paintSection, paintStripes, type StripeOptions } from '../../core/colors'
import {
  createRow,
  createSection,
  estimateYarnMetres,
  refreshInstruction,
  renumber,
  totalRows,
  totalStitches,
} from '../../core/patterns/rows'
import type {
  Id,
  PatternRow,
  PatternSection,
  Project,
  StitchId,
  WorkDirection,
} from '../../core/types'
import type { ProjectPatch } from '../../data/repositories/projectRepository'
import { usePatternSync } from '../studio/usePatternSync'

/**
 * The Pattern Studio's editing operations.
 *
 * Recalculation itself lives in `usePatternSync`, shared with the 3D studio;
 * what is here is everything that edits the pattern by hand — rows, sections,
 * constraints, colour placement and progress.
 */
export function usePatternStudio(project: Project, update: (patch: ProjectPatch) => void) {
  // Recalculation and its conflict rules are shared with the 3D studio, where
  // measurements can also be edited.
  const sync = usePatternSync(project, update)
  const { commitPattern } = sync

  /* ----------------------------------------------------------- mutations -- */

  const mapSections = useCallback(
    (fn: (sections: PatternSection[]) => PatternSection[]) => {
      commitPattern({ ...project.pattern, sections: fn(project.pattern.sections) })
    },
    [commitPattern, project.pattern],
  )

  const mapSection = useCallback(
    (sectionId: Id, fn: (section: PatternSection) => PatternSection) => {
      mapSections((sections) =>
        sections.map((section) => (section.id === sectionId ? fn(section) : section)),
      )
    },
    [mapSections],
  )

  const mapRow = useCallback(
    (sectionId: Id, rowId: Id, fn: (row: PatternRow) => PatternRow) => {
      mapSection(sectionId, (section) => ({
        ...section,
        rows: section.rows.map((row) => (row.id === rowId ? fn(row) : row)),
      }))
    },
    [mapSection],
  )

  /**
   * Editing a count or a stitch by hand locks the row: the user has taken it
   * over, and recalculation must stop rewriting it.
   */
  const setRowStitchCount = useCallback(
    (sectionId: Id, rowId: Id, stitchCount: number) => {
      mapRow(sectionId, rowId, (row) => ({
        ...row,
        stitchCount,
        locked: true,
        instruction: describeFromRow({ ...row, stitchCount }),
      }))
    },
    [mapRow],
  )

  const setRowStitch = useCallback(
    (sectionId: Id, rowId: Id, stitch: StitchId) => {
      mapRow(sectionId, rowId, (row) => ({
        ...row,
        stitch,
        locked: true,
        instruction: describeFromRow({ ...row, stitch }),
      }))
    },
    [mapRow],
  )

  const setRowNote = useCallback(
    (sectionId: Id, rowId: Id, note: string) => {
      mapRow(sectionId, rowId, (row) => ({ ...row, note }))
    },
    [mapRow],
  )

  /** Releasing the lock hands the row back to the calculation engine. */
  const toggleRowLock = useCallback(
    (sectionId: Id, rowId: Id) => {
      mapRow(sectionId, rowId, (row) =>
        row.locked ? refreshInstruction({ ...row, locked: false }) : { ...row, locked: true },
      )
    },
    [mapRow],
  )

  const deleteRow = useCallback(
    (sectionId: Id, rowId: Id) => {
      mapSection(sectionId, (section) => ({
        ...section,
        rows: renumber(section.rows.filter((row) => row.id !== rowId)),
        // A hand-trimmed section is no longer purely generated.
        generatedBy: section.generatedBy,
      }))
    },
    [mapSection],
  )

  const addRowAfter = useCallback(
    (sectionId: Id, rowId: Id | null) => {
      mapSection(sectionId, (section) => {
        const position =
          rowId === null ? section.rows.length - 1 : section.rows.findIndex((row) => row.id === rowId)
        const reference = section.rows[position] ?? section.rows.at(-1)

        const row = createRow({
          index: position + 2,
          stitch: reference?.stitch ?? 'dc',
          stitchCount: reference?.stitchCount ?? 1,
          locked: true,
        })

        const rows = [...section.rows]
        rows.splice(position + 1, 0, row)
        return { ...section, rows: renumber(rows) }
      })
    },
    [mapSection],
  )

  const addSection = useCallback(
    (name: string, direction: WorkDirection) => {
      // `generatedBy: null` marks it as the user's own: recalculation never touches it.
      mapSections((sections) => [...sections, createSection(name, direction, [])])
    },
    [mapSections],
  )

  const renameSection = useCallback(
    (sectionId: Id, name: string) => {
      mapSection(sectionId, (section) => ({ ...section, name }))
    },
    [mapSection],
  )

  const setSectionNotes = useCallback(
    (sectionId: Id, notes: string) => {
      mapSection(sectionId, (section) => ({ ...section, notes }))
    },
    [mapSection],
  )

  const deleteSection = useCallback(
    (sectionId: Id) => {
      mapSections((sections) => sections.filter((section) => section.id !== sectionId))
    },
    [mapSections],
  )

  const setRepeat = useCallback(
    (repeat: number) => {
      commitPattern({ ...project.pattern, repeat: Math.max(1, Math.round(repeat)) })
    },
    [commitPattern, project.pattern],
  )

  const setEdgeStitches = useCallback(
    (edgeStitches: number) => {
      commitPattern({ ...project.pattern, edgeStitches: Math.max(0, Math.round(edgeStitches)) })
    },
    [commitPattern, project.pattern],
  )

  const setMinStitches = useCallback(
    (minStitches: number) => {
      commitPattern({ ...project.pattern, minStitches: Math.max(0, Math.round(minStitches)) })
    },
    [commitPattern, project.pattern],
  )

  const setShapingStep = useCallback(
    (shapingStep: number) => {
      commitPattern({ ...project.pattern, shapingStep: Math.max(1, Math.round(shapingStep)) })
    },
    [commitPattern, project.pattern],
  )

  const setCompletedRows = useCallback(
    (completedRows: number) => {
      const total = totalRows(project.pattern)
      update({
        progress: { completedRows: Math.min(Math.max(0, completedRows), total), totalRows: total },
      })
    },
    [project.pattern, update],
  )

  const clearPattern = useCallback(() => {
    commitPattern({ ...project.pattern, sections: [] })
    sync.dismissConflicts()
  }, [commitPattern, project.pattern, sync])

  /* -------------------------------------------------------------- colour -- */

  const setSectionColor = useCallback(
    (sectionId: Id, colorId: Id | null) => {
      commitPattern(paintSection(project.pattern, sectionId, colorId))
    },
    [commitPattern, project.pattern],
  )

  const setRowColor = useCallback(
    (sectionId: Id, rowId: Id, colorId: Id | null) => {
      commitPattern(paintRow(project.pattern, sectionId, rowId, colorId))
    },
    [commitPattern, project.pattern],
  )

  const applyStripes = useCallback(
    (options: StripeOptions) => {
      commitPattern(paintStripes(project.pattern, options))
    },
    [commitPattern, project.pattern],
  )

  const stats = useMemo(
    () => ({
      rows: totalRows(project.pattern),
      stitches: totalStitches(project.pattern),
      metres: estimateYarnMetres(project.pattern, project.gauge.hookSizeMm),
    }),
    [project.gauge.hookSizeMm, project.pattern],
  )

  return {
    ...sync,
    clearPattern,
    stats,
    setSectionColor,
    setRowColor,
    applyStripes,
    setRowStitchCount,
    setRowStitch,
    setRowNote,
    toggleRowLock,
    deleteRow,
    addRowAfter,
    addSection,
    renameSection,
    setSectionNotes,
    deleteSection,
    setRepeat,
    setEdgeStitches,
    setMinStitches,
    setShapingStep,
    setCompletedRows,
  }
}

/** Re-words a row after a manual edit, mirroring the generator's phrasing. */
function describeFromRow(row: PatternRow): string {
  return refreshInstruction({ ...row, locked: false }).instruction
}
