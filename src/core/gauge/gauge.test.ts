import { describe, expect, it } from 'vitest'
import type { Gauge } from '../types'
import {
  heightForRows,
  rowsForHeight,
  rowsPerCm,
  roundCount,
  stitchesForWidth,
  stitchesPerCm,
  widthForStitches,
} from './index'

/** The gauge from the specification: 20 stitches and 15 rows per 10 cm. */
const SPEC_GAUGE: Gauge = {
  stitchCount: 20,
  rowCount: 15,
  swatchWidthCm: 10,
  swatchHeightCm: 10,
  stitch: 'dc',
  hookSizeMm: 4,
}

describe('the specification example', () => {
  it('gives 80 stitches for 40 cm', () => {
    expect(stitchesForWidth(40, SPEC_GAUGE).count).toBe(80)
  })

  it('gives 45 rows for 30 cm', () => {
    expect(rowsForHeight(30, SPEC_GAUGE).count).toBe(45)
  })

  it('needs no adjustment, because the numbers come out whole', () => {
    expect(stitchesForWidth(40, SPEC_GAUGE).derivation.adjustments).toEqual([])
    expect(rowsForHeight(30, SPEC_GAUGE).derivation.adjustments).toEqual([])
  })
})

describe('gauge density', () => {
  it('reads the swatch as measured rather than assuming 10 cm', () => {
    const inchSwatch: Gauge = {
      ...SPEC_GAUGE,
      stitchCount: 16,
      rowCount: 12,
      swatchWidthCm: 10.16,
      swatchHeightCm: 10.16,
    }

    expect(stitchesPerCm(inchSwatch)).toBeCloseTo(1.5748, 4)
    expect(rowsPerCm(inchSwatch)).toBeCloseTo(1.1811, 4)
  })

  it('refuses a swatch with no size instead of returning Infinity', () => {
    expect(() => stitchesPerCm({ ...SPEC_GAUGE, swatchWidthCm: 0 })).toThrow(/échantillon/)
    expect(() => rowsPerCm({ ...SPEC_GAUGE, swatchHeightCm: 0 })).toThrow(/échantillon/)
  })
})

describe('rounding', () => {
  it('rounds halves up, in one place', () => {
    expect(roundCount(44.5)).toBe(45)
    expect(roundCount(44.49)).toBe(44)
    expect(roundCount(2.5)).toBe(3)
  })

  it('records the rounding as an adjustment the user can read', () => {
    const result = stitchesForWidth(37, SPEC_GAUGE)

    expect(result.count).toBe(74)
    expect(result.derivation.rawResult).toBe(74)

    const odd = stitchesForWidth(37.3, SPEC_GAUGE)
    expect(odd.count).toBe(75)
    expect(odd.derivation.adjustments[0]?.reason).toMatch(/Arrondi/)
    expect(odd.derivation.rawResult).toBe(74.6)
  })
})

describe('pattern constraints', () => {
  it('rounds to a multiple of the repeat and says so', () => {
    const result = stitchesForWidth(40, SPEC_GAUGE, { repeat: 6 })

    expect(result.count).toBe(78)
    expect(result.derivation.adjustments.at(-1)?.reason).toMatch(/multiple du motif/)
  })

  it('never drops below one full repeat', () => {
    expect(stitchesForWidth(1, SPEC_GAUGE, { repeat: 12 }).count).toBe(12)
  })

  it('adds edge stitches outside the repeat', () => {
    const result = stitchesForWidth(40, SPEC_GAUGE, { repeat: 6, edgeStitches: 2 })

    expect(result.count).toBe(80)
    expect(result.derivation.adjustments.at(-1)?.reason).toMatch(/lisière/)
  })

  it('forces an even count for mirrored panels', () => {
    const result = stitchesForWidth(37.5, SPEC_GAUGE, { requireEven: true })

    expect(result.count % 2).toBe(0)
    expect(result.derivation.adjustments.at(-1)?.reason).toMatch(/pair/)
  })

  it('respects a structural minimum', () => {
    const result = stitchesForWidth(0.5, SPEC_GAUGE, { minimum: 6 })

    expect(result.count).toBe(6)
    expect(result.derivation.adjustments.at(-1)?.reason).toMatch(/Minimum/)
  })
})

describe('reverse conversion', () => {
  it('reports the size a count actually produces', () => {
    expect(widthForStitches(80, SPEC_GAUGE)).toBe(40)
    expect(heightForRows(45, SPEC_GAUGE)).toBe(30)
  })

  it('shows the real width after a repeat adjustment', () => {
    const result = stitchesForWidth(40, SPEC_GAUGE, { repeat: 6 })

    // 78 stitches at 2 st/cm is 39 cm, not the 40 cm asked for.
    expect(widthForStitches(result.count, SPEC_GAUGE)).toBe(39)
  })
})

describe('derivation trail', () => {
  it('carries the inputs, the formula and the final figure', () => {
    const { derivation } = stitchesForWidth(40, SPEC_GAUGE)

    expect(derivation.formula).toContain('largeur')
    expect(derivation.inputs['mailles par cm']).toBe(2)
    expect(derivation.inputs['largeur (cm)']).toBe(40)
    expect(derivation.finalResult).toBe(80)
  })
})
