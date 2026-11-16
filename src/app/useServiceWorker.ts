import { useCallback, useEffect, useState } from 'react'
import { isTauri } from './runtime'

/**
 * Service worker registration.
 *
 * Only in a production build: the dev server has no `sw.js`, and a stale worker
 * caching a dev bundle is a confusing way to spend an afternoon.
 *
 * An update is never applied on its own. The new worker waits, the UI offers to
 * reload, and only then is `SKIP_WAITING` sent — nobody wants the page to change
 * under them while they are counting a row.
 */
export function useServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    // The desktop shell already has the files on disk; a worker there would
    // cache a custom protocol for no benefit.
    if (isTauri()) return
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        if (cancelled) return

        if (registration.active && !navigator.serviceWorker.controller) {
          setOfflineReady(true)
        }

        if (registration.waiting) {
          setWaiting(registration.waiting)
          setUpdateReady(true)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return

          installing.addEventListener('statechange', () => {
            if (installing.state !== 'installed') return

            if (navigator.serviceWorker.controller) {
              // A previous version is in charge, so this really is an update.
              setWaiting(installing)
              setUpdateReady(true)
            } else {
              setOfflineReady(true)
            }
          })
        })
      } catch {
        // An unavailable worker only costs offline support; the app still runs.
      }
    }

    void register()

    return () => {
      cancelled = true
    }
  }, [])

  const applyUpdate = useCallback(() => {
    if (!waiting) {
      window.location.reload()
      return
    }

    // Reload once the new worker has taken over, so the fresh assets are used.
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    )
    waiting.postMessage('SKIP_WAITING')
  }, [waiting])

  const dismiss = useCallback(() => setUpdateReady(false), [])

  return { updateReady, offlineReady, applyUpdate, dismiss }
}
