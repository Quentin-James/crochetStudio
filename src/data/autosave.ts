/**
 * Debounced saving.
 *
 * Keeps writes off the typing path (one write per pause, not per keystroke) while
 * guaranteeing nothing is lost: pending changes are flushed when the page is
 * hidden, which on iPadOS is the last callback you reliably get before Safari
 * suspends or discards the tab.
 */

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface Autosaver<T> {
  /** Queue a change. Later calls replace earlier pending values. */
  schedule: (value: T) => void
  /** Write any pending change immediately. */
  flush: () => Promise<void>
  /** Drop any pending change without writing it. */
  cancel: () => void
  /** Stop listening for page-hide events. */
  dispose: () => void
  hasPending: () => boolean
}

export interface AutosaverOptions<T> {
  save: (value: T) => Promise<void>
  delayMs: number
  onStatus?: (status: SaveStatus, error?: Error) => void
}

export function createAutosaver<T>({
  save,
  delayMs,
  onStatus,
}: AutosaverOptions<T>): Autosaver<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { value: T } | null = null
  let inFlight: Promise<void> = Promise.resolve()

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const write = async () => {
    clearTimer()
    if (!pending) return

    const { value } = pending
    pending = null
    onStatus?.('saving')

    try {
      await save(value)
      onStatus?.('saved')
    } catch (error) {
      onStatus?.('error', error instanceof Error ? error : new Error(String(error)))
    }
  }

  const flush = async () => {
    // Chain onto any in-flight write so two saves can't interleave.
    inFlight = inFlight.then(write, write)
    await inFlight
  }

  const onPageHide = () => {
    if (pending) void flush()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && pending) void flush()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return {
    schedule(value: T) {
      pending = { value }
      onStatus?.('pending')
      clearTimer()
      timer = setTimeout(() => void flush(), delayMs)
    },
    flush,
    cancel() {
      clearTimer()
      pending = null
    },
    hasPending: () => pending !== null,
    dispose() {
      clearTimer()
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide)
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    },
  }
}
