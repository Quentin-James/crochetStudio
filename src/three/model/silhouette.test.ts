import { describe, expect, it } from 'vitest'
import { generatePattern } from '../../core/patterns/generators'
import { buildProject } from '../../core/projectFactory'
import type { Project, ProjectCategory } from '../../core/types'
import { buildModelSpec } from './silhouette'

/**
 * The default gauge is 20 stitches and 15 rows per 10 cm, so 2 stitches and
 * 1.5 rows per centimetre — every expected figure below is derived from that.
 */
function makeProject(category: ProjectCategory, withPattern: boolean): Project {
  const project = buildProject({ name: 'Test', category }, { now: 1, id: 'p1' })
  if (!withPattern) return project

  const { pattern } = generatePattern({
    category,
    gauge: project.gauge,
    dimensions: project.dimensions,
  })
  return { ...project, pattern }
}

describe('a dress built from its pattern', () => {
  const spec = buildModelSpec(makeProject('dress', true))

  it('comes from the pattern, not the measurements', () => {
    expect(spec.source).toBe('pattern')
    expect(spec.warnings).toEqual([])
    expect(spec.kind).toBe('revolution')
  })

  it('starts at the hem and ends at the shoulders', () => {
    // The hem edging is worked last but sits lowest: 224 stitches around.
    expect(spec.rings[0]?.stitches).toBe(224)
    // The bodice is worked first and sits highest: 184 stitches.
    expect(spec.rings.at(-1)?.stitches).toBe(184)
  })

  it('takes each ring radius from its round’s stitch count', () => {
    // 224 stitches at 2 st/cm is 112 cm around, so a radius of 112 / 2π.
    expect(spec.rings[0]?.radius).toBeCloseTo(112 / (2 * Math.PI), 4)
    expect(spec.rings.at(-1)?.radius).toBeCloseTo(92 / (2 * Math.PI), 4)
  })

  it('stacks rings in order, from the base upwards', () => {
    const heights = spec.rings.map((ring) => ring.y)
    expect(heights[0]).toBeGreaterThanOrEqual(0)
    for (let index = 1; index < heights.length; index += 1) {
      expect(heights[index]).toBeGreaterThanOrEqual(heights[index - 1] as number)
    }
  })

  it('gets its height from the stitch heights, not the row count alone', () => {
    // 57 bodice rows + 90 skirt rows of double crochet at 1.5 rows/cm = 98 cm,
    // plus two single-crochet edging rounds, which are half as tall.
    expect(spec.totalHeightCm).toBeCloseTo(98 + 2 / 3, 1)
  })

  it('leaves the hem open and squashes the cross-section slightly', () => {
    expect(spec.closedBase).toBe(false)
    expect(spec.depthRatio).toBeLessThan(1)
  })

  it('reports the stitch count used for the stitch texture', () => {
    expect(spec.stitchesAround).toBe(224)
    expect(spec.rowCount).toBe(149)
  })
})

describe('a bag built from its pattern', () => {
  const spec = buildModelSpec(makeProject('bag', true))

  it('closes the base', () => {
    expect(spec.closedBase).toBe(true)
  })

  it('grows the base outwards instead of upwards', () => {
    // The base rounds stay near the bottom while their radius increases.
    const low = spec.rings.filter((ring) => ring.y < 1)
    expect(low.length).toBeGreaterThan(3)
    const radii = low.map((ring) => ring.radius)
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii) * 2)
  })

  it('walls the body at the base perimeter', () => {
    // 130 stitches around the oval base, at 2 st/cm → 65 cm, radius 65 / 2π.
    expect(spec.maxRadiusCm).toBeCloseTo(65 / (2 * Math.PI), 2)
    expect(spec.stitchesAround).toBe(130)
  })

  it('derives the strap from its own section', () => {
    // 84 rows of double crochet is 56 cm — twice the 28 cm handle drop.
    expect(spec.strap?.lengthCm).toBeCloseTo(56, 1)
    expect(spec.strap?.widthCm).toBeCloseTo(3, 1)
  })

  it('follows the strap width the user asked for', () => {
    const project = makeProject('bag', false)
    const dimensions = { ...project.dimensions, strapWidth: 8 }
    const { pattern } = generatePattern({
      category: 'bag',
      gauge: project.gauge,
      dimensions,
    })

    const wide = buildModelSpec({ ...project, dimensions, pattern })

    // 8 cm at 2 stitches per cm is 16 stitches across the band.
    expect(wide.strap?.widthCm).toBeCloseTo(8, 1)
    expect(wide.strap?.lengthCm).toBeCloseTo(56, 1)
  })

  it('makes the cross-section oval, from the depth', () => {
    expect(spec.depthRatio).toBeGreaterThan(0.18)
    expect(spec.depthRatio).toBeLessThan(0.6)
  })
})

describe('an accessory built from its pattern', () => {
  const spec = buildModelSpec(makeProject('accessory', true))

  it('is a hanging panel when worked flat', () => {
    expect(spec.kind).toBe('panel')
    expect(spec.panel?.widthCm).toBeCloseTo(25, 1)
    expect(spec.panel?.heightCm).toBeCloseTo(150, 1)
    expect(spec.rings).toEqual([])
  })

  it('becomes a tube when a circumference is set', () => {
    const base = buildProject({ name: 'Snood', category: 'accessory' }, { now: 1, id: 'p2' })
    const dimensions = { width: 25, height: 30, circumference: 56 }
    const { pattern } = generatePattern({
      category: 'accessory',
      gauge: base.gauge,
      dimensions,
    })

    const tube = buildModelSpec({ ...base, dimensions, pattern })

    expect(tube.kind).toBe('revolution')
    expect(tube.stitchesAround).toBe(112)
    expect(tube.maxRadiusCm).toBeCloseTo(56 / (2 * Math.PI), 4)
  })
})

describe('without a pattern', () => {
  it('falls back to the measurements and says so', () => {
    const spec = buildModelSpec(makeProject('dress', false))

    expect(spec.source).toBe('dimensions')
    expect(spec.warnings.join(' ')).toMatch(/Aucun motif/)
    expect(spec.rings.length).toBeGreaterThanOrEqual(2)
    expect(spec.totalHeightCm).toBeCloseTo(98, 0)
  })

  it('still builds a bag with a strap', () => {
    const spec = buildModelSpec(makeProject('bag', false))

    expect(spec.source).toBe('dimensions')
    expect(spec.closedBase).toBe(true)
    expect(spec.strap).not.toBeNull()
  })
})

describe('with an unusable gauge', () => {
  it('warns instead of dividing by zero', () => {
    const project = makeProject('dress', true)
    const spec = buildModelSpec({
      ...project,
      gauge: { ...project.gauge, swatchWidthCm: 0 },
    })

    expect(spec.source).toBe('dimensions')
    expect(spec.warnings.join(' ')).toMatch(/échantillon est incomplet/)
    expect(Number.isFinite(spec.maxRadiusCm)).toBe(true)
  })
})

describe('reacting to a change', () => {
  it('widens the model when a round gains stitches', () => {
    const narrow = makeProject('bag', true)
    const wider = {
      ...narrow,
      dimensions: { ...narrow.dimensions, width: 40 },
    }
    const { pattern } = generatePattern({
      category: 'bag',
      gauge: wider.gauge,
      dimensions: wider.dimensions,
    })

    const before = buildModelSpec(narrow)
    const after = buildModelSpec({ ...wider, pattern })

    expect(after.maxRadiusCm).toBeGreaterThan(before.maxRadiusCm)
    expect(after.stitchesAround).toBeGreaterThan(before.stitchesAround)
  })

  it('follows a hand-edited stitch count', () => {
    const project = makeProject('accessory', true)
    const tubeDimensions = { width: 25, height: 30, circumference: 56 }
    const { pattern } = generatePattern({
      category: 'accessory',
      gauge: project.gauge,
      dimensions: tubeDimensions,
    })

    const edited = {
      ...pattern,
      sections: pattern.sections.map((section) => ({
        ...section,
        rows: section.rows.map((row) =>
          row.stitch === 'ch' ? row : { ...row, stitchCount: 160, locked: true },
        ),
      })),
    }

    const spec = buildModelSpec({ ...project, dimensions: tubeDimensions, pattern: edited })

    // 160 stitches at 2 st/cm is 80 cm around, whatever the measurements say.
    expect(spec.maxRadiusCm).toBeCloseTo(80 / (2 * Math.PI), 4)
  })
})
