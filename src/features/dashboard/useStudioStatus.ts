import { useEffect, useState } from 'react'
import { db, getStorageReport, type StorageReport } from '../../data/db'

export interface StudioStatus {
  state: 'checking' | 'ready' | 'error'
  /** Dexie schema version actually open, confirming the database initialised. */
  dbVersion: number | null
  storage: StorageReport | null
  error: string | null
}

/**
 * Opens the local database and reads the real Storage API numbers.
 *
 * This is a genuine health check rather than a decorative panel: if IndexedDB is
 * blocked (private browsing, a locked-down WebView), the dashboard says so
 * instead of failing later when the user tries to save a project.
 */
export function useStudioStatus(): StudioStatus {
  const [status, setStatus] = useState<StudioStatus>({
    state: 'checking',
    dbVersion: null,
    storage: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        await db.open()
        const storage = await getStorageReport()
        if (cancelled) return
        setStatus({
          state: 'ready',
          dbVersion: Math.round(db.verno),
          storage,
          error: null,
        })
      } catch (error) {
        if (cancelled) return
        setStatus({
          state: 'error',
          dbVersion: null,
          storage: null,
          error: error instanceof Error ? error.message : 'Unknown storage error',
        })
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
