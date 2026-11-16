import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Id, Project, ProjectDraft } from '../../core/types'
import {
  createProject,
  deleteProject,
  duplicateProject,
  setActiveProject,
} from '../../data/repositories/projectRepository'
import { useSettings } from '../../app/SettingsProvider'

/**
 * Project create / duplicate / delete, shared by the dashboard and the library.
 *
 * Failures are surfaced as `error` rather than swallowed: a write that didn't
 * happen must be visible to the user, because there is no server copy to fall
 * back on.
 */
export function useProjectActions() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setError(null)
    try {
      return await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const create = useCallback(
    async (draft: ProjectDraft): Promise<Project | null> => {
      const project = await run(async () => {
        const created = await createProject(draft, settings)
        await setActiveProject(created.id)
        return created
      })
      if (project) navigate(`/projects/${project.id}`)
      return project
    },
    [navigate, run, settings],
  )

  const duplicate = useCallback(
    async (id: Id): Promise<Project | null> => run(() => duplicateProject(id)),
    [run],
  )

  const remove = useCallback(
    async (id: Id): Promise<boolean> => {
      const result = await run(async () => {
        await deleteProject(id)
        return true
      })
      return result === true
    },
    [run],
  )

  return { busy, error, clearError: () => setError(null), create, duplicate, remove }
}
