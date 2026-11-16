import { describe, expect, it } from 'vitest'
import { formatRelative } from './dates'

const NOW = new Date('2026-11-15T21:00:00Z').getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelative', () => {
  it('reports very recent edits as "just now"', () => {
    expect(formatRelative(NOW - 20_000, NOW)).toBe('just now')
  })

  it('counts minutes and hours, singular and plural', () => {
    expect(formatRelative(NOW - MINUTE, NOW)).toBe('1 minute ago')
    expect(formatRelative(NOW - 12 * MINUTE, NOW)).toBe('12 minutes ago')
    expect(formatRelative(NOW - HOUR, NOW)).toBe('1 hour ago')
    expect(formatRelative(NOW - 5 * HOUR, NOW)).toBe('5 hours ago')
  })

  it('says yesterday, then counts days up to a week', () => {
    expect(formatRelative(NOW - DAY, NOW)).toBe('yesterday')
    expect(formatRelative(NOW - 3 * DAY, NOW)).toBe('3 days ago')
  })

  it('falls back to a date beyond a week', () => {
    expect(formatRelative(NOW - 30 * DAY, NOW)).toMatch(/2026/)
  })

  it('shows a date for timestamps in the future rather than a negative age', () => {
    expect(formatRelative(NOW + 5 * DAY, NOW)).toMatch(/2026/)
  })
})
