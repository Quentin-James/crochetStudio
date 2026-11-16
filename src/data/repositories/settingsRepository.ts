import { DEFAULT_SETTINGS } from '../../core/defaults'
import type { AppSettings } from '../../core/types'
import { db } from '../db'

/**
 * Application settings persistence.
 *
 * Settings live in a single row keyed `'app'`, so a read is one lookup and a
 * write is atomic. Reads merge over `DEFAULT_SETTINGS`, which means a settings
 * row written by an older version of the app gains new fields with sane values
 * instead of leaving them undefined.
 */

export const SETTINGS_KEY = 'app' as const

export async function readSettings(): Promise<AppSettings> {
  const record = await db.settings.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...record?.value }
}

/** Creates the settings row on first run and returns the effective settings. */
export async function ensureSettings(): Promise<AppSettings> {
  return db.transaction('rw', db.settings, async () => {
    const record = await db.settings.get(SETTINGS_KEY)
    const settings: AppSettings = { ...DEFAULT_SETTINGS, ...record?.value }
    await db.settings.put({ key: SETTINGS_KEY, value: settings })
    return settings
  })
}

/** Merges a partial change into the stored settings and returns the result. */
export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return db.transaction('rw', db.settings, async () => {
    const record = await db.settings.get(SETTINGS_KEY)
    const next: AppSettings = { ...DEFAULT_SETTINGS, ...record?.value, ...patch }
    await db.settings.put({ key: SETTINGS_KEY, value: next })
    return next
  })
}

export async function replaceSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: { ...DEFAULT_SETTINGS, ...settings } })
}
