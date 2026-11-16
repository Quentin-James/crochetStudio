// Gives Node a real IndexedDB implementation, so these tests exercise the actual
// Dexie schema, transactions and indexes rather than a mock.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../core/defaults'
import { db } from './db'
import {
  createProject,
  deleteProject,
  duplicateProject,
  getProject,
  listProjects,
  setActiveProject,
  updateProject,
} from './repositories/projectRepository'
import {
  ensureSettings,
  patchSettings,
  readSettings,
} from './repositories/settingsRepository'
import {
  eraseAllData,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
} from './backup/backup'

beforeEach(async () => {
  await db.open()
  await eraseAllData()
  await ensureSettings()
})

describe('project persistence', () => {
  it('stores a project and reads it back', async () => {
    const created = await createProject(
      { name: 'Garden party dress', category: 'dress' },
      DEFAULT_SETTINGS,
    )

    const loaded = await getProject(created.id)
    expect(loaded?.name).toBe('Garden party dress')
    expect(loaded?.dimensions.circumference).toBe(92)
  })

  it('survives closing and reopening the database', async () => {
    await createProject({ name: 'Market bag', category: 'bag' }, DEFAULT_SETTINGS)

    db.close()
    await db.open()

    const projects = await listProjects()
    expect(projects.map((project) => project.name)).toEqual(['Market bag'])
  })

  it('gives a colliding name a unique variant instead of overwriting', async () => {
    await createProject({ name: 'Scarf', category: 'accessory' }, DEFAULT_SETTINGS)
    const second = await createProject({ name: 'Scarf', category: 'accessory' }, DEFAULT_SETTINGS)

    expect(second.name).toBe('Scarf (copie)')
    expect(await db.projects.count()).toBe(2)
  })

  it('lists the most recently edited project first', async () => {
    const first = await createProject({ name: 'First', category: 'bag' }, DEFAULT_SETTINGS)
    await createProject({ name: 'Second', category: 'bag' }, DEFAULT_SETTINGS)

    // `updatedAt` has millisecond resolution, and these writes complete inside a
    // single millisecond; the wait makes the edit genuinely later rather than tied.
    await new Promise((resolve) => setTimeout(resolve, 5))
    await updateProject(first.id, { notes: 'touched' })

    const projects = await listProjects()
    expect(projects[0]?.name).toBe('First')
  })

  it('stamps updatedAt on every write', async () => {
    const created = await createProject({ name: 'Tote', category: 'bag' }, DEFAULT_SETTINGS)
    await updateProject(created.id, { notes: 'Handles done' })

    const loaded = await getProject(created.id)
    expect(loaded?.notes).toBe('Handles done')
    expect(loaded?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
  })

  it('drops dimensions that do not belong to a new category', async () => {
    const created = await createProject({ name: 'Rework', category: 'bag' }, DEFAULT_SETTINGS)
    expect(created.dimensions.handleDrop).toBeDefined()

    await updateProject(created.id, { category: 'dress' })

    const loaded = await getProject(created.id)
    expect(loaded?.category).toBe('dress')
    expect(loaded?.dimensions.handleDrop).toBeUndefined()
  })

  it('rejects an update to a project that no longer exists', async () => {
    await expect(updateProject('missing-id', { notes: 'x' })).rejects.toThrow(/n’existe plus/)
  })

  it('duplicates a project without touching the original', async () => {
    const original = await createProject(
      { name: 'Market bag', category: 'bag' },
      DEFAULT_SETTINGS,
    )
    await updateProject(original.id, { progress: { completedRows: 12, totalRows: 40 } })

    const copy = await duplicateProject(original.id)

    expect(copy.id).not.toBe(original.id)
    expect(copy.name).toBe('Market bag (copie)')
    expect(copy.progress.completedRows).toBe(0)
    expect((await getProject(original.id))?.progress.completedRows).toBe(12)
  })

  it('clears the active project when that project is deleted', async () => {
    const created = await createProject({ name: 'Cowl', category: 'accessory' }, DEFAULT_SETTINGS)
    await setActiveProject(created.id)
    expect((await readSettings()).activeProjectId).toBe(created.id)

    await deleteProject(created.id)

    expect(await getProject(created.id)).toBeUndefined()
    expect((await readSettings()).activeProjectId).toBeNull()
  })

  it('leaves the active project alone when a different project is deleted', async () => {
    const kept = await createProject({ name: 'Kept', category: 'bag' }, DEFAULT_SETTINGS)
    const other = await createProject({ name: 'Other', category: 'bag' }, DEFAULT_SETTINGS)
    await setActiveProject(kept.id)

    await deleteProject(other.id)

    expect((await readSettings()).activeProjectId).toBe(kept.id)
  })
})

describe('settings persistence', () => {
  it('merges unknown fields over the defaults', async () => {
    await patchSettings({ units: 'imperial' })
    const settings = await readSettings()

    expect(settings.units).toBe('imperial')
    expect(settings.autosaveDelayMs).toBe(DEFAULT_SETTINGS.autosaveDelayMs)
  })

  it('keeps earlier changes when a later patch touches another field', async () => {
    await patchSettings({ units: 'imperial' })
    await patchSettings({ defaultSize: 'L' })

    const settings = await readSettings()
    expect(settings.units).toBe('imperial')
    expect(settings.defaultSize).toBe('L')
  })
})

describe('backup round trip', () => {
  it('exports, re-parses and restores the library', async () => {
    await createProject({ name: 'Garden party dress', category: 'dress' }, DEFAULT_SETTINGS)
    await createProject({ name: 'Market bag', category: 'bag' }, DEFAULT_SETTINGS)
    await patchSettings({ units: 'imperial' })

    const text = serializeBackup(await exportBackup())

    await eraseAllData()
    expect(await db.projects.count()).toBe(0)

    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const result = await importBackup(parsed.document, 'replace')

    expect(result.projectsImported).toBe(2)
    expect((await listProjects()).map((project) => project.name).sort()).toEqual([
      'Garden party dress',
      'Market bag',
    ])
    expect((await readSettings()).units).toBe('imperial')
  })

  it('merging keeps existing projects and updates matching ids', async () => {
    const kept = await createProject({ name: 'Kept', category: 'bag' }, DEFAULT_SETTINGS)
    const backup = await exportBackup()

    await updateProject(kept.id, { name: 'Renamed locally' })
    await createProject({ name: 'Added later', category: 'accessory' }, DEFAULT_SETTINGS)

    const result = await importBackup(backup, 'merge')

    expect(result.projectsReplaced).toBe(1)
    expect(result.projectsImported).toBe(0)

    const names = (await listProjects()).map((project) => project.name).sort()
    expect(names).toEqual(['Added later', 'Kept'])
  })

  it('does not restore an active project id that was not imported', async () => {
    const created = await createProject({ name: 'Solo', category: 'bag' }, DEFAULT_SETTINGS)
    await setActiveProject(created.id)

    const backup = await exportBackup()
    const withoutProjects = { ...backup, projects: [] }

    await importBackup(withoutProjects, 'replace')

    expect((await readSettings()).activeProjectId).toBeNull()
  })
})

describe('backup validation', () => {
  it('rejects text that is not JSON', () => {
    const result = parseBackup('not json at all')
    expect(result).toEqual({ ok: false, error: 'That file is not valid JSON.' })
  })

  it('rejects JSON that is not a backup', () => {
    const result = parseBackup('{"hello":"world"}')
    expect(result.ok).toBe(false)
  })

  it('rejects a backup from a newer format version', () => {
    const result = parseBackup(
      JSON.stringify({ format: 'crochet-studio-backup', formatVersion: 99, projects: [] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/newer version/)
  })

  it('names the offending project when one is malformed', () => {
    const result = parseBackup(
      JSON.stringify({
        format: 'crochet-studio-backup',
        formatVersion: 1,
        projects: [
          {
            id: 'a',
            name: 'Broken',
            category: 'hovercraft',
            createdAt: 1,
            updatedAt: 1,
            gauge: {},
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Broken/)
  })

  it('accepts a valid envelope with no projects', () => {
    const result = parseBackup(
      JSON.stringify({ format: 'crochet-studio-backup', formatVersion: 1, projects: [] }),
    )
    expect(result.ok).toBe(true)
  })
})
