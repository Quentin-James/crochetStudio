/**
 * Date formatting.
 *
 * `now` is a parameter rather than a call to `Date.now()` inside these functions
 * so they are deterministic and testable.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** e.g. "just now", "12 minutes ago", "yesterday", "3 Nov 2026". */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const elapsed = now - timestamp

  if (elapsed < 0) return formatDate(timestamp)
  if (elapsed < MINUTE) return 'just now'

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE)
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(elapsed / DAY)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`

  return formatDate(timestamp)
}

/** e.g. "3 Nov 2026". */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** e.g. "3 Nov 2026 at 21:40" — used where the exact moment matters. */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${formatDate(timestamp)} at ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}
