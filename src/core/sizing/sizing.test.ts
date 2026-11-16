import { describe, expect, it } from 'vitest'
import { DEFAULT_SIZING } from '../defaults'
import type { SizingState } from '../types'
import { compareSizes, deriveDimensions, effectiveMeasurements, hasOverrides, SIZE_TABLE } from './index'

const sizing = (overrides: Partial<SizingState> = {}): SizingState => ({
  ...DEFAULT_SIZING,
  ...overrides,
})

describe('the size table', () => {
  it('grows monotonically from XS to XXL', () => {
    const busts = (['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map((size) => SIZE_TABLE[size].bust)
    const sorted = [...busts].sort((a, b) => a - b)

    expect(busts).toEqual(sorted)
  })
})

describe('effectiveMeasurements', () => {
  it('returns the table for the active size', () => {
    expect(effectiveMeasurements(sizing({ activeSize: 'L' })).bust).toBe(98)
  })

  it('lets a hand-typed override win', () => {
    const state = sizing({ activeSize: 'M', overrides: { M: { bust: 95 } } })

    expect(effectiveMeasurements(state).bust).toBe(95)
    // Untouched measurements still come from the table.
    expect(effectiveMeasurements(state).waist).toBe(74)
  })

  it('uses the custom profile when the active size is custom', () => {
    const state = sizing({ activeSize: 'custom', customProfileId: 'p1' })

    expect(effectiveMeasurements(state, { bust: 88, waist: 70 })).toEqual({ bust: 88, waist: 70 })
  })

  it('reports which sizes the user has edited', () => {
    const state = sizing({ overrides: { M: { bust: 95 } } })

    expect(hasOverrides(state, 'M')).toBe(true)
    expect(hasOverrides(state, 'L')).toBe(false)
  })
})

describe('deriveDimensions', () => {
  it('adds ease to the bust and halves the hip for a flat hem', () => {
    const result = deriveDimensions('dress', SIZE_TABLE.M, 6, {})

    expect(result.circumference).toBe(98) // 92 + 6
    expect(result.width).toBe(52) // (98 + 6) / 2
    expect(result.bodiceLength).toBe(40)
  })

  it('accepts negative ease', () => {
    expect(deriveDimensions('dress', SIZE_TABLE.M, -4, {}).circumference).toBe(88)
  })

  it('never derives the skirt length, which is a design choice', () => {
    const result = deriveDimensions('dress', SIZE_TABLE.M, 0, { skirtLength: 75 })

    expect(result.skirtLength).toBe(75)
  })

  it('leaves bags and accessories untouched, because they are not body-sized', () => {
    const bag = { width: 28, height: 24, depth: 8, handleDrop: 28 }

    expect(deriveDimensions('bag', SIZE_TABLE.XXL, 10, bag)).toEqual(bag)
    expect(deriveDimensions('accessory', SIZE_TABLE.XXL, 10, { width: 25 })).toEqual({ width: 25 })
  })
})

describe('compareSizes', () => {
  it('lists every measurement across every size', () => {
    const rows = compareSizes(sizing())

    expect(rows).toHaveLength(8)
    expect(rows[0]?.label).toBe('Tour de poitrine')
    expect(rows[0]?.values.XS).toBe(82)
    expect(rows[0]?.values.XXL).toBe(114)
  })

  it('shows the override rather than the table value', () => {
    const rows = compareSizes(sizing({ overrides: { L: { bust: 101 } } }))

    expect(rows[0]?.values.L).toBe(101)
  })
})
