import { describe, expect, it } from 'vitest'
import { formatBytes, formatLength, fromCm, parseLength, round, toCm } from './index'

describe('unit conversion', () => {
  it('round-trips centimetres through inches without drift', () => {
    expect(round(toCm(fromCm(40, 'imperial'), 'imperial'), 6)).toBe(40)
  })

  it('leaves metric values untouched', () => {
    expect(fromCm(40, 'metric')).toBe(40)
    expect(toCm(40, 'metric')).toBe(40)
  })

  it('converts to inches at 2.54 cm per inch', () => {
    expect(round(fromCm(25.4, 'imperial'), 4)).toBe(10)
  })
})

describe('formatLength', () => {
  it('omits a pointless decimal in metric', () => {
    expect(formatLength(40, 'metric')).toBe('40 cm')
  })

  it('keeps a meaningful decimal in metric', () => {
    expect(formatLength(40.5, 'metric')).toBe('40.5 cm')
  })

  it('always shows one decimal in imperial', () => {
    expect(formatLength(25.4, 'imperial')).toBe('10.0 in')
  })
})

describe('parseLength', () => {
  it('accepts a comma decimal separator', () => {
    expect(parseLength('40,5', 'metric')).toBe(40.5)
  })

  it('ignores a trailing unit the user typed', () => {
    expect(parseLength('40 cm', 'metric')).toBe(40)
  })

  it('converts imperial input to stored centimetres', () => {
    expect(round(parseLength('10in', 'imperial') ?? 0, 4)).toBe(25.4)
  })

  it('returns null for input with no number', () => {
    expect(parseLength('', 'metric')).toBeNull()
    expect(parseLength('cm', 'metric')).toBeNull()
  })
})

describe('formatBytes', () => {
  it('reports bytes, kB and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 kB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
