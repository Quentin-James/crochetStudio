import { buildProject, cloneProject, uniqueName } from '../../core/projectFactory'
import { migrateProject, migrateProjects } from '../../core/migrate'
import { pruneDimensions } from '../../core/categories'
import type { AppSettings, Id, Project, ProjectDraft } from '../../core/types'
import { db } from '../db'
import { patchSettings, readSettings } from './settingsRepository'

/**
 * Project persistence.
 *
 * The only module that writes to `db.projects`. Every mutation stamps
 * `updatedAt` here so no caller can forget, and all multi-step operations run in
 * a transaction so the library can never be seen half-updated.
 */

export async function listProjects(): Promise<Project[]> {
  // Documents are upgraded on read, so a library saved by an older build opens
  // without a database-wide migration step.
  return migrateProjects(await db.projects.orderBy('updatedAt').reverse().toArray())
}

export async function getProject(id: Id): Promise<Project | undefined> {
  const project = await db.projects.get(id)
  return project ? migrateProject(project) : undefined
}

export async function countProjects(): Promise<number> {
  return db.projects.count()
}

export async function createProject(
  draft: ProjectDraft,
  settings: AppSettings,
): Promise<Project> {
  return db.transaction('rw', db.projects, async () => {
    const existingNames = await db.projects.orderBy('name').keys()
    const project = buildProject(draft, { settings })
    project.name = uniqueName(project.name, existingNames as string[])
    await db.projects.add(project)
    return project
  })
}

/**
 * Applies a partial change. `id`, `createdAt` and `schemaVersion` are not
 * patchable — they identify the document rather than describe it.
 */
export type ProjectPatch = Partial<Omit<Project, 'id' | 'createdAt' | 'schemaVersion'>>

export async function updateProject(id: Id, patch: ProjectPatch): Promise<void> {
  const next: ProjectPatch = { ...patch, updatedAt: Date.now() }

  // Changing category invalidates dimensions that belong to the old one.
  if (patch.category !== undefined) {
    const current = await db.projects.get(id)
    const dimensions = patch.dimensions ?? current?.dimensions ?? {}
    next.dimensions = pruneDimensions(dimensions, patch.category)
  }

  const updated = await db.projects.update(id, next)
  if (updated === 0) {
    throw new Error(`Le projet ${id} n’existe plus`)
  }
}

export async function duplicateProject(id: Id): Promise<Project> {
  return db.transaction('rw', db.projects, async () => {
    const source = await db.projects.get(id)
    if (!source) throw new Error(`Le projet ${id} n’existe plus`)

    const existingNames = (await db.projects.orderBy('name').keys()) as string[]
    const copy = cloneProject(source)
    copy.name = uniqueName(copy.name, existingNames)
    await db.projects.add(copy)
    return copy
  })
}

export async function deleteProject(id: Id): Promise<void> {
  await db.transaction('rw', db.projects, db.settings, async () => {
    await db.projects.delete(id)

    // Don't leave the studio pointing at a project that no longer exists.
    const settings = await readSettings()
    if (settings.activeProjectId === id) {
      await patchSettings({ activeProjectId: null })
    }
  })
}

/** Marks a project as the one the studio workspaces are working on. */
export async function setActiveProject(id: Id | null): Promise<void> {
  await patchSettings({ activeProjectId: id })
}
