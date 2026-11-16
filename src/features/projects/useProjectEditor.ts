import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '../../core/types'
import { createAutosaver, type Autosaver, type SaveStatus } from '../../data/autosave'
import { updateProject, type ProjectPatch } from '../../data/repositories/projectRepository'
import { useSettings } from '../../app/SettingsProvider'

export interface ProjectEditor {
  /** The project as the user currently sees it, including unsaved keystrokes. */
  draft: Project | null
  status: SaveStatus
  lastSavedAt: number | null
  /** Apply a change: updates the draft and queues a debounced write. */
  update: (patch: ProjectPatch) => void
  /** Write pending changes immediately (the manual "Save now" command). */
  saveNow: () => Promise<void>
}

/**
 * Editing with autosave.
 *
 * Changes land in a local draft so typing stays responsive, and are written
 * through a debounced saver that also flushes when the page is hidden. Patches
 * accumulate between writes, so a change to one field can never discard a
 * still-unwritten change to another.
 */
export function useProjectEditor(project: Project | null): ProjectEditor {
  const { settings } = useSettings()
  const [draft, setDraft] = useState<Project | null>(project)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const loadedIdRef = useRef<string | null>(null)
  const saverRef = useRef<Autosaver<ProjectPatch> | null>(null)
  const pendingRef = useRef<ProjectPatch>({})

  // Adopt the loaded project once per id. Live updates from the database must not
  // overwrite the draft mid-edit, which is why this is keyed on the id only.
  useEffect(() => {
    if (project === null) {
      loadedIdRef.current = null
      setDraft(null)
      return
    }
    if (loadedIdRef.current !== project.id) {
      loadedIdRef.current = project.id
      pendingRef.current = {}
      setDraft(project)
    }
  }, [project])

  const projectId = project?.id ?? null

  useEffect(() => {
    if (projectId === null) {
      saverRef.current = null
      return
    }

    const saver = createAutosaver<ProjectPatch>({
      delayMs: settings.autosaveDelayMs,
      save: async (patch) => {
        await updateProject(projectId, patch)
        pendingRef.current = {}
        setLastSavedAt(Date.now())
      },
      onStatus: (next) => setStatus(next),
    })

    saverRef.current = saver

    return () => {
      // Leaving the page must not lose the last keystrokes.
      void saver.flush().finally(() => saver.dispose())
      saverRef.current = null
    }
  }, [projectId, settings.autosaveDelayMs])

  const update = useCallback((patch: ProjectPatch) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    pendingRef.current = { ...pendingRef.current, ...patch }
    saverRef.current?.schedule(pendingRef.current)
  }, [])

  const saveNow = useCallback(async () => {
    await saverRef.current?.flush()
  }, [])

  return { draft, status, lastSavedAt, update, saveNow }
}
