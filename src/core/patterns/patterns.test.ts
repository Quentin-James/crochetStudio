import { describe, expect, it } from 'vitest'
import type { Gauge, Pattern } from '../types'
import { generatePattern } from './generators'
import { recalculatePattern } from './recalc'
import { estimateYarnMetres, totalRows } from './rows'

const GAUGE: Gauge = {
  stitchCount: 20,
  rowCount: 15,
  swatchWidthCm: 10,
  swatchHeightCm: 10,
  stitch: 'dc',
  hookSizeMm: 4,
}

describe('dress generation', () => {
  const result = generatePattern({
    category: 'dress',
    gauge: GAUGE,
    dimensions: { circumference: 92, bodiceLength: 38, skirtLength: 60, width: 56 },
  })

  it('builds a bodice, a skirt and an edging', () => {
    expect(result.pattern.sections.map((section) => section.name)).toEqual([
      'Corsage',
      'Jupe',
      'Bordure de l’ourlet',
    ])
  })

  it('derives the bodice from the gauge', () => {
    const bodice = result.pattern.sections[0]
    // 92 cm at 2 st/cm = 184 stitches, 38 cm at 1.5 rows/cm = 57 rows.
    expect(bodice?.rows[0]?.stitchCount).toBe(184)
    expect(bodice?.rows).toHaveLength(57)
  })

  it('widens the skirt from the bodice count to the hem count', () => {
    const skirt = result.pattern.sections[1]
    // Hem is 56 cm flat, so 112 cm round = 224 stitches.
    expect(skirt?.rows.at(-1)?.stitchCount).toBe(224)
    expect(skirt?.rows[0]?.stitchCount).toBe(184)
  })

  it('works the bodice in the round', () => {
    expect(result.pattern.sections[0]?.direction).toBe('inTheRound')
  })

  it('explains every count it produced', () => {
    const labels = result.derivations.map((derivation) => derivation.label)

    expect(labels).toContain('Corsage — mailles du tour')
    expect(labels).toContain('Jupe — façonnage')
    expect(result.derivations.every((d) => d.formula.length > 0)).toBe(true)
  })

  it('warns instead of guessing when the hem width is missing', () => {
    const noHem = generatePattern({
      category: 'dress',
      gauge: GAUGE,
      dimensions: { circumference: 92, bodiceLength: 38, skirtLength: 60 },
    })

    expect(noHem.warnings.join(' ')).toMatch(/largeur d’ourlet/i)
  })

  it('refuses to invent a missing bust measurement', () => {
    const noBust = generatePattern({
      category: 'dress',
      gauge: GAUGE,
      dimensions: { bodiceLength: 38 },
    })

    expect(noBust.pattern.sections).toEqual([])
    expect(noBust.warnings.join(' ')).toMatch(/Tour de poitrine/)
  })
})

describe('bag generation', () => {
  const result = generatePattern({
    category: 'bag',
    gauge: GAUGE,
    dimensions: { width: 28, height: 24, depth: 8, handleDrop: 28 },
  })

  it('builds a base, a body, an edging and a strap', () => {
    expect(result.pattern.sections.map((section) => section.name)).toEqual([
      'Base ovale',
      'Corps',
      'Bordure de l’ouverture',
      'Bandoulière',
    ])
  })

  it('starts the base with a foundation chain', () => {
    const base = result.pattern.sections[0]

    expect(base?.rows[0]?.stitch).toBe('ch')
    // The straight run is 28 − 8 = 20 cm, so 40 chains at 2 st/cm.
    expect(base?.rows[0]?.stitchCount).toBe(40)
  })

  it('grows the base to its calculated perimeter', () => {
    const base = result.pattern.sections[0]
    // π × 8 + 2 × 20 = 65.1 cm → 130 stitches.
    expect(base?.rows.at(-1)?.stitchCount).toBe(130)
  })

  it('works the body straight on the base perimeter', () => {
    const body = result.pattern.sections[1]

    expect(body?.rows).toHaveLength(36)
    expect(body?.rows.every((row) => row.stitchCount === 130)).toBe(true)
  })

  it('makes the strap twice the handle drop', () => {
    const strap = result.pattern.sections[3]

    // 2 × 28 cm at 1.5 rows/cm = 84 rows.
    expect(strap?.rows).toHaveLength(84)
    expect(strap?.direction).toBe('flat')
  })

  it('treats a zero depth as a seamed tube and says so', () => {
    const flat = generatePattern({
      category: 'bag',
      gauge: GAUGE,
      dimensions: { width: 28, height: 24, depth: 0, handleDrop: 0 },
    })

    expect(flat.pattern.sections.map((section) => section.name)).toEqual([
      'Corps',
      'Bordure de l’ouverture',
    ])
    expect(flat.warnings.join(' ')).toMatch(/tube/)
    expect(flat.warnings.join(' ')).toMatch(/bandoulière/i)
  })
})

describe('accessory generation', () => {
  it('works a flat panel from width and height', () => {
    const result = generatePattern({
      category: 'accessory',
      gauge: GAUGE,
      dimensions: { width: 25, height: 150 },
    })

    const panel = result.pattern.sections[0]
    expect(panel?.name).toBe('Panneau')
    expect(panel?.direction).toBe('flat')
    // A foundation chain plus 225 rows of 50 stitches.
    expect(panel?.rows[1]?.stitchCount).toBe(50)
    expect(panel?.rows).toHaveLength(226)
  })

  it('switches to the round when a circumference is given', () => {
    const result = generatePattern({
      category: 'accessory',
      gauge: GAUGE,
      dimensions: { width: 25, height: 30, circumference: 56 },
    })

    const panel = result.pattern.sections[0]
    expect(panel?.name).toBe('Tube')
    expect(panel?.direction).toBe('inTheRound')
    expect(panel?.rows[1]?.stitchCount).toBe(112)
  })

  it('applies the repeat and the edge stitches', () => {
    const result = generatePattern({
      category: 'accessory',
      gauge: GAUGE,
      dimensions: { width: 25, height: 30 },
      repeat: 6,
      edgeStitches: 2,
    })

    const stitches = result.pattern.sections[0]?.rows[1]?.stitchCount ?? 0
    expect((stitches - 2) % 6).toBe(0)
  })
})

describe('written instructions', () => {
  it('phrases straight and shaped rows in French crochet terms', () => {
    const result = generatePattern({
      category: 'dress',
      gauge: GAUGE,
      dimensions: { circumference: 92, bodiceLength: 38, skirtLength: 60, width: 56 },
    })

    expect(result.pattern.sections[0]?.rows[0]?.instruction).toBe('184 br (184 m)')

    const shaped = result.pattern.sections[1]?.rows.find((row) => row.shaping.delta !== 0)
    expect(shaped?.instruction).toMatch(/augmentations \(\d+ m\)/)
  })
})

describe('yarn estimate', () => {
  it('scales with the hook and the number of stitches', () => {
    const small = generatePattern({
      category: 'accessory',
      gauge: GAUGE,
      dimensions: { width: 25, height: 30 },
    }).pattern

    const metres = estimateYarnMetres(small, GAUGE.hookSizeMm)
    const thicker = estimateYarnMetres(small, GAUGE.hookSizeMm * 2)

    expect(metres).toBeGreaterThan(0)
    expect(thicker).toBeCloseTo(metres * 2, 5)
  })
})

describe('recalculation after a change', () => {
  const base = {
    category: 'accessory' as const,
    gauge: GAUGE,
    dimensions: { width: 25, height: 30 },
  }

  const makeEdited = (): Pattern => {
    const pattern = generatePattern(base).pattern
    const section = pattern.sections[0]
    if (!section) throw new Error('expected a generated section')

    // The user takes row 3 over by hand.
    const rows = section.rows.map((row) =>
      row.index === 3 ? { ...row, stitchCount: 44, locked: true, note: 'resserré ici' } : row,
    )
    return { ...pattern, sections: [{ ...section, rows }] }
  }

  it('rewrites unlocked rows for the new measurements', () => {
    const result = recalculatePattern(makeEdited(), { ...base, dimensions: { width: 40, height: 30 } })
    const rows = result.pattern.sections[0]?.rows ?? []

    expect(rows[1]?.stitchCount).toBe(80)
    expect(result.recalculatedRows).toBeGreaterThan(0)
  })

  it('keeps a locked row and reports the disagreement', () => {
    const result = recalculatePattern(makeEdited(), { ...base, dimensions: { width: 40, height: 30 } })
    const locked = result.pattern.sections[0]?.rows.find((row) => row.index === 3)

    expect(locked?.stitchCount).toBe(44)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.kind).toBe('lockedRowDiffers')
    expect(result.conflicts[0]?.calculatedStitchCount).toBe(80)
    expect(result.conflicts[0]?.message).toMatch(/rang 3/)
  })

  it('raises no conflict when the locked row still agrees', () => {
    const pattern = makeEdited()
    const section = pattern.sections[0]
    if (!section) throw new Error('expected a generated section')
    const agreeing = {
      ...pattern,
      sections: [
        {
          ...section,
          rows: section.rows.map((row) =>
            row.index === 3 ? { ...row, stitchCount: 50, locked: true } : row,
          ),
        },
      ],
    }

    const result = recalculatePattern(agreeing, base)
    expect(result.conflicts).toEqual([])
    expect(result.preservedRows).toBe(1)
  })

  it('keeps hand-edited rows that fall past the new end', () => {
    // 0.5 cm at 1.5 rows/cm rounds to a single row, so the locked row 3 no
    // longer has a place in the recalculated section.
    const result = recalculatePattern(makeEdited(), {
      ...base,
      dimensions: { width: 25, height: 0.5 },
    })

    const kept = result.pattern.sections[0]?.rows.find((row) => row.note === 'resserré ici')
    expect(kept).toBeDefined()
    expect(result.conflicts.some((conflict) => conflict.kind === 'lockedRowBeyondEnd')).toBe(true)
  })

  it('keeps the user’s notes on rows it recalculates', () => {
    const pattern = generatePattern(base).pattern
    const section = pattern.sections[0]
    if (!section) throw new Error('expected a generated section')
    const annotated = {
      ...pattern,
      sections: [
        {
          ...section,
          rows: section.rows.map((row) =>
            row.index === 4 ? { ...row, note: 'changer de pelote' } : row,
          ),
        },
      ],
    }

    const result = recalculatePattern(annotated, { ...base, dimensions: { width: 40, height: 30 } })
    const row = result.pattern.sections[0]?.rows.find((entry) => entry.index === 4)

    expect(row?.note).toBe('changer de pelote')
    expect(row?.stitchCount).toBe(80)
  })

  it('never touches sections the user created by hand', () => {
    const pattern = generatePattern(base).pattern
    const manual = {
      ...pattern,
      sections: [
        ...pattern.sections,
        {
          id: 'manual-1',
          name: 'Mes finitions',
          direction: 'flat' as const,
          rows: [],
          notes: 'à moi',
          generatedBy: null,
          colorId: null,
        },
      ],
    }

    const result = recalculatePattern(manual, { ...base, dimensions: { width: 40, height: 30 } })

    expect(result.pattern.sections.at(-1)).toEqual(manual.sections.at(-1))
  })

  it('keeps the total row count in step with the pattern', () => {
    const result = recalculatePattern(makeEdited(), {
      ...base,
      dimensions: { width: 25, height: 20 },
    })

    expect(totalRows(result.pattern)).toBe(result.pattern.sections[0]?.rows.length)
  })
})
