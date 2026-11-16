import { DEFAULT_SETTINGS, PROJECT_SCHEMA_VERSION } from '../../core/defaults'
import { CATEGORY_ORDER } from '../../core/categories'
import { migrateProjects } from '../../core/migrate'
import type { AppSettings, Project, ProjectCategory, SizeProfile } from '../../core/types'
import { db } from '../db'
import { replaceSettings } from '../repositories/settingsRepository'

/**
 * Whole-database backup.
 *
 * This is the only route for moving work between the desktop and the iPad (there
 * is no server to sync through), so the format is explicit and versioned, and the
 * importer validates before it writes anything.
 */

export const BACKUP_FORMAT = 'crochet-studio-backup'
export const BACKUP_FORMAT_VERSION = 1

export interface BackupDocument {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  exportedAt: number
  projectSchemaVersion: number
  projects: Project[]
  sizeProfiles: SizeProfile[]
  settings: AppSettings
}

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  projectsImported: number
  projectsReplaced: number
  sizeProfilesImported: number
}

/* ------------------------------------------------------------------ export -- */

export async function exportBackup(): Promise<BackupDocument> {
  return db.transaction('r', db.projects, db.sizeProfiles, db.settings, async () => {
    const [projects, sizeProfiles, settingsRecord] = await Promise.all([
      db.projects.toArray(),
      db.sizeProfiles.toArray(),
      db.settings.get('app'),
    ])

    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: Date.now(),
      projectSchemaVersion: PROJECT_SCHEMA_VERSION,
      projects,
      sizeProfiles,
      settings: { ...DEFAULT_SETTINGS, ...settingsRecord?.value },
    }
  })
}

export function serializeBackup(document: BackupDocument): string {
  return JSON.stringify(document, null, 2)
}

/** e.g. `crochet-studio-backup-2026-11-15.json` */
export function backupFilename(exportedAt: number): string {
  const date = new Date(exportedAt).toISOString().slice(0, 10)
  return `crochet-studio-backup-${date}.json`
}

/* ------------------------------------------------------------- validation -- */

export type ParseResult =
  | { ok: true; document: BackupDocument }
  | { ok: false; error: string }

/**
 * Parses and validates a backup file.
 *
 * Deliberately strict about the envelope and the fields the app relies on to
 * render a library, and deliberately tolerant about the rest: a project saved by
 * a future version may carry fields this build doesn't know, and dropping the
 * import for that reason would lose the user's work.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'That file does not contain a backup document.' }
  }

  const candidate = raw as Partial<BackupDocument>

  if (candidate.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'That file is not a Crochet Studio backup.' }
  }

  if (typeof candidate.formatVersion !== 'number') {
    return { ok: false, error: 'The backup is missing its format version.' }
  }

  if (candidate.formatVersion > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      error: `That backup was written by a newer version of Crochet Studio (format ${candidate.formatVersion}, this build reads ${BACKUP_FORMAT_VERSION}).`,
    }
  }

  if (!Array.isArray(candidate.projects)) {
    return { ok: false, error: 'The backup has no project list.' }
  }

  const categories = new Set<string>(CATEGORY_ORDER)
  for (const [index, project] of candidate.projects.entries()) {
    const problem = validateProject(project, index, categories)
    if (problem) return { ok: false, error: problem }
  }

  return {
    ok: true,
    document: {
      format: BACKUP_FORMAT,
      formatVersion: candidate.formatVersion,
      exportedAt: typeof candidate.exportedAt === 'number' ? candidate.exportedAt : Date.now(),
      projectSchemaVersion:
        typeof candidate.projectSchemaVersion === 'number'
          ? candidate.projectSchemaVersion
          : PROJECT_SCHEMA_VERSION,
      projects: candidate.projects,
      sizeProfiles: Array.isArray(candidate.sizeProfiles) ? candidate.sizeProfiles : [],
      settings: { ...DEFAULT_SETTINGS, ...candidate.settings },
    },
  }
}

function validateProject(
  project: unknown,
  index: number,
  categories: ReadonlySet<string>,
): string | null {
  const where = `Project ${index + 1}`
  if (typeof project !== 'object' || project === null) return `${where} is not an object.`

  const p = project as Partial<Project>
  if (typeof p.id !== 'string' || p.id === '') return `${where} has no id.`
  if (typeof p.name !== 'string') return `${where} has no name.`
  if (typeof p.category !== 'string' || !categories.has(p.category)) {
    return `${where} ("${p.name}") has an unknown category "${String(p.category)}".`
  }
  if (typeof p.createdAt !== 'number' || typeof p.updatedAt !== 'number') {
    return `${where} ("${p.name}") has invalid dates.`
  }
  if (typeof p.gauge !== 'object' || p.gauge === null) {
    return `${where} ("${p.name}") has no gauge.`
  }
  return null
}

/* ------------------------------------------------------------------ import -- */

export async function importBackup(
  document: BackupDocument,
  mode: ImportMode,
): Promise<ImportResult> {
  return db.transaction('rw', db.projects, db.sizeProfiles, db.settings, async () => {
    if (mode === 'replace') {
      await Promise.all([db.projects.clear(), db.sizeProfiles.clear()])
    }

    const existingIds = new Set(await db.projects.toCollection().primaryKeys())
    const replaced = document.projects.filter((project) => existingIds.has(project.id)).length

    // A backup may have been written by an older build; upgrade on the way in.
    await db.projects.bulkPut(migrateProjects(document.projects))
    await db.sizeProfiles.bulkPut(document.sizeProfiles)

    if (mode === 'replace') {
      // Imported settings may point at a project the user did not keep.
      const activeExists =
        document.settings.activeProjectId !== null &&
        document.projects.some((project) => project.id === document.settings.activeProjectId)
      await replaceSettings({
        ...document.settings,
        activeProjectId: activeExists ? document.settings.activeProjectId : null,
      })
    }

    return {
      projectsImported: document.projects.length - replaced,
      projectsReplaced: replaced,
      sizeProfilesImported: document.sizeProfiles.length,
    }
  })
}

/** Project counts by category, used to describe a backup before importing it. */
export function summariseBackup(document: BackupDocument): Record<ProjectCategory, number> {
  const counts: Record<ProjectCategory, number> = { dress: 0, bag: 0, accessory: 0 }
  for (const project of document.projects) {
    counts[project.category] += 1
  }
  return counts
}

/** Clears every table. Irreversible — callers must confirm with the user first. */
export async function eraseAllData(): Promise<void> {
  await db.transaction('rw', db.projects, db.sizeProfiles, db.settings, async () => {
    await Promise.all([db.projects.clear(), db.sizeProfiles.clear(), db.settings.clear()])
  })
}
