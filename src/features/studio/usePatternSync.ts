import { useCallback, useEffect, useMemo, useState } from 'react'
import { recalculatePattern, type PatternConflict } from '../../core/patterns/recalc'
import { patternSignature, totalRows } from '../../core/patterns/rows'
import type { Pattern, Project } from '../../core/types'
import type { ProjectPatch } from '../../data/repositories/projectRepository'

/**
 * Keeping the pattern in step with the measurements.
 *
 * Shared by both studios, because a measurement can now be changed in either
 * one: editing a bag's width in the 3D studio must follow exactly the same rules
 * as editing it in the pattern editor — recalculate silently when nothing of the
 * user's is at stake, ask first when hand-edited rows would be affected.
 */
export interface PatternSync {
  /** A recalculation computed but not applied. */
  plan: ReturnType<typeof recalculatePattern>
  isEmpty: boolean
  isStale: boolean
  hasLockedRows: boolean
  conflicts: PatternConflict[]
  apply: () => void
  dismissConflicts: () => void
  /** Writes a pattern and keeps the progress counters consistent with it. */
  commitPattern: (pattern: Pattern) => void
}

export function usePatternSync(
  project: Project,
  update: (patch: ProjectPatch) => void,
): PatternSync {
  const [conflicts, setConflicts] = useState<PatternConflict[]>([])

  const plan = useMemo(
    () =>
      recalculatePattern(project.pattern, {
        category: project.category,
        dimensions: project.dimensions,
        gauge: project.gauge,
        stitch: project.gauge.stitch,
        repeat: project.pattern.repeat,
        edgeStitches: project.pattern.edgeStitches,
        minStitches: project.pattern.minStitches,
        shapingStep: project.pattern.shapingStep,
      }),
    [project.category, project.dimensions, project.gauge, project.pattern],
  )

  const isEmpty = project.pattern.sections.length === 0

  const hasLockedRows = useMemo(
    () => project.pattern.sections.some((section) => section.rows.some((row) => row.locked)),
    [project.pattern],
  )

  const isStale = useMemo(
    () => !isEmpty && patternSignature(plan.pattern) !== patternSignature(project.pattern),
    [isEmpty, plan.pattern, project.pattern],
  )

  const commitPattern = useCallback(
    (pattern: Pattern) => {
      const total = totalRows(pattern)
      update({
        pattern,
        progress: {
          completedRows: Math.min(project.progress.completedRows, total),
          totalRows: total,
        },
      })
    },
    [project.progress.completedRows, update],
  )

  const apply = useCallback(() => {
    commitPattern(plan.pattern)
    setConflicts(plan.conflicts)
  }, [commitPattern, plan])

  // Nothing of the user's is at stake, so keep the pattern in step silently.
  useEffect(() => {
    if (isStale && !hasLockedRows) {
      commitPattern(plan.pattern)
      setConflicts([])
    }
  }, [commitPattern, hasLockedRows, isStale, plan.pattern])

  return {
    plan,
    isEmpty,
    isStale,
    hasLockedRows,
    conflicts,
    apply,
    dismissConflicts: () => setConflicts([]),
    commitPattern,
  }
}
