import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, Project, SizeProfile } from '../core/types'

/**
 * The local database.
 *
 * IndexedDB via Dexie — chosen over SQLite/WASM because the access pattern is
 * document-shaped (one project = one nested object read and written whole) and
 * because OPFS-backed SQLite is fragile on iPad Safari. See docs/ARCHITECTURE.md §5.
 *
 * Only `data/repositories` writes to these tables; features never touch them directly.
 */

/** Settings are stored as a single row so they can be read and replaced atomically. */
export interface SettingsRecord {
  key: 'app'
  value: AppSettings
}

const DB_NAME = 'crochet-studio'

export class CrochetStudioDb extends Dexie {
  /**
   * Indexes mirror how the project library queries: by recency, by category,
   * by name, and by tag (multi-entry).
   */
  projects!: EntityTable<Project, 'id'>
  sizeProfiles!: EntityTable<SizeProfile, 'id'>
  settings!: EntityTable<SettingsRecord, 'key'>

  constructor() {
    super(DB_NAME)

    this.version(1).stores({
      projects: 'id, name, category, createdAt, updatedAt, *tags',
      sizeProfiles: 'id, name, basedOn, updatedAt',
      settings: 'key',
    })
  }
}

export const db = new CrochetStudioDb()

/**
 * Asks the browser to exempt our data from eviction.
 *
 * On iPad Safari this is what separates "installed to the Home Screen" storage
 * from ordinary website storage that WebKit may clear after a period of disuse.
 * Returns the resulting persistence state, or null when the API is unavailable.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') {
    return null
  }
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export interface StorageReport {
  persisted: boolean | null
  usageBytes: number | null
  quotaBytes: number | null
}

/** Real numbers from the Storage API, used by Settings and the dashboard status card. */
export async function getStorageReport(): Promise<StorageReport> {
  if (!('storage' in navigator)) {
    return { persisted: null, usageBytes: null, quotaBytes: null }
  }

  const persisted =
    typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() : null

  if (typeof navigator.storage.estimate !== 'function') {
    return { persisted, usageBytes: null, quotaBytes: null }
  }

  const estimate = await navigator.storage.estimate()
  return {
    persisted,
    usageBytes: estimate.usage ?? null,
    quotaBytes: estimate.quota ?? null,
  }
}
