import { describe, expect, it } from 'vitest'
import type { ModelSpec, Ring } from './silhouette'
import { STITCH_INSTANCE_LIMIT, buildStitchField } from './stitches'

const ring = (y: number, stitches: number, color = '#D9B6B0', stitchColors: string[] | null = null): Ring => ({
  y,
  radius: 10,
  stitches,
  color,
  stitchColors,
})

function spec(rings: Ring[], overrides: Partial<ModelSpec> = {}): ModelSpec {
  return {
    kind: 'revolution',
    rings,
    panel: null,
    strap: null,
    depthRatio: 1,
    closedBase: false,
    stitchesAround: Math.max(...rings.map((r) => r.stitches)),
    rowCount: rings.length,
    totalHeightCm: rings.at(-1)?.y ?? 0,
    maxRadiusCm: 10,
    source: 'pattern',
    warnings: [],
    ...overrides,
  }
}

describe('the stitch field', () => {
  it('places one instance per stitch of every row after the first', () => {
    const field = buildStitchField(spec([ring(0, 40), ring(1, 40), ring(2, 40)]), 1)

    // The opening ring is the base of row 1, so it contributes no stitches.
    expect(field?.requested).toBe(80)
    expect(field?.count).toBe(80)
    expect(field?.capped).toBe(false)
  })

  it('follows each round’s own stitch count', () => {
    const field = buildStitchField(spec([ring(0, 20), ring(1, 20), ring(2, 32)]), 1)

    expect(field?.requested).toBe(52)
  })

  it('spreads the stitches around the body rather than bunching them', () => {
    const field = buildStitchField(spec([ring(0, 8), ring(1, 8)]), 1)
    const positions = (field?.matrices ?? []).map((matrix) => ({
      x: matrix.elements[12] as number,
      z: matrix.elements[14] as number,
    }))

    expect(positions).toHaveLength(8)
    // Eight stitches around a 10 cm radius: all of them at that radius, at
    // eight different angles.
    for (const position of positions) {
      expect(Math.hypot(position.x, position.z)).toBeGreaterThan(9)
      expect(Math.hypot(position.x, position.z)).toBeLessThan(12)
    }
    expect(new Set(positions.map((p) => Math.round(p.x * 100))).size).toBeGreaterThan(4)
  })

  it('uses the colour of each stitch when the row carries colourwork', () => {
    const colors = Array.from({ length: 6 }, (_unused, index) =>
      index % 2 === 0 ? '#44382F' : '#D9B6B0',
    )
    const field = buildStitchField(spec([ring(0, 6), ring(1, 6, '#D9B6B0', colors)]), 1)

    expect(field?.colors).toHaveLength(6)
    expect(field?.colors[0]?.getHexString()).toBe('44382f')
    expect(field?.colors[1]?.getHexString()).toBe('d9b6b0')
  })

  it('thins an oversized field evenly instead of cutting it short', () => {
    const rows = 40
    const perRow = 2000 // 78 000 stitches, well over the cap
    const rings = Array.from({ length: rows }, (_unused, index) => ring(index, perRow))

    const field = buildStitchField(spec(rings), 1)

    expect(field?.requested).toBe(perRow * (rows - 1))
    expect(field?.capped).toBe(true)
    expect(field?.count).toBeLessThanOrEqual(STITCH_INSTANCE_LIMIT)
    // Thinning must keep covering the whole height, not stop half-way up.
    const heights = (field?.matrices ?? []).map((matrix) => matrix.elements[13] as number)
    expect(Math.max(...heights)).toBeGreaterThan(rows * 0.8)
  })

  it('has nothing to place on a flat panel', () => {
    expect(buildStitchField(spec([ring(0, 10)], { kind: 'panel' }), 1)).toBeNull()
  })

  it('has nothing to place without a pattern', () => {
    expect(buildStitchField(spec([ring(0, 0), ring(1, 0)]), 1)).toBeNull()
  })
})
