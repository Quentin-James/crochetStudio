import { describe, expect, it } from 'vitest'
import { distributeShaping } from './shaping'

const sum = (deltas: readonly number[]) => deltas.reduce((total, delta) => total + delta, 0)

describe('distributeShaping', () => {
  it('reaches the target stitch count exactly', () => {
    const plan = distributeShaping(48, 96, 30)

    expect(plan.to).toBe(96)
    expect(plan.schedule.at(-1)?.total).toBe(96)
    expect(sum(plan.schedule.map((row) => row.delta))).toBe(48)
  })

  it('returns one entry per row, including the straight ones', () => {
    const plan = distributeShaping(48, 60, 20)

    expect(plan.schedule).toHaveLength(20)
    expect(plan.schedule.filter((row) => row.delta !== 0)).toHaveLength(plan.shapingRowCount)
  })

  it('leaves the first row unshaped by default', () => {
    const plan = distributeShaping(40, 70, 15)

    expect(plan.schedule[0]?.delta).toBe(0)
  })

  it('spreads the shaping instead of bunching it at one end', () => {
    const plan = distributeShaping(60, 72, 24)
    const shapedRows = plan.schedule.filter((row) => row.delta !== 0).map((row) => row.row)

    expect(shapedRows).toHaveLength(6)
    // Six shaping rows across 23 available rows: no two adjacent, none in the
    // first row, and the last one inside the section.
    expect(Math.min(...shapedRows)).toBeGreaterThan(1)
    expect(Math.max(...shapedRows)).toBeLessThanOrEqual(24)
    const gaps = shapedRows.slice(1).map((row, index) => row - (shapedRows[index] as number))
    expect(Math.min(...gaps)).toBeGreaterThan(1)
  })

  it('handles decreases', () => {
    const plan = distributeShaping(96, 48, 30)

    expect(plan.to).toBe(48)
    expect(plan.schedule.every((row) => row.delta <= 0)).toBe(true)
    expect(plan.derivation.label).toBe('Diminutions')
  })

  it('works straight when there is nothing to change', () => {
    const plan = distributeShaping(60, 60, 12)

    expect(plan.shapingRowCount).toBe(0)
    expect(plan.schedule.every((row) => row.delta === 0)).toBe(true)
    expect(plan.warnings).toEqual([])
  })

  it('warns, but still reaches the target, when the rows are too few', () => {
    const plan = distributeShaping(40, 100, 5)

    expect(plan.to).toBe(100)
    expect(plan.warnings.join(' ')).toMatch(/regroupés/)
  })

  it('warns and stays straight when a single row cannot be shaped', () => {
    const plan = distributeShaping(40, 60, 1)

    expect(plan.schedule).toHaveLength(1)
    expect(plan.schedule[0]?.delta).toBe(0)
    expect(plan.warnings.join(' ')).toMatch(/Trop peu de rangs/)
  })

  it('uses a bigger step per row when asked', () => {
    const plan = distributeShaping(60, 120, 40, { stepPerRow: 6 })

    expect(plan.shapingRowCount).toBe(10)
    expect(plan.to).toBe(120)
  })

  it('reports an odd change honestly rather than overshooting', () => {
    const plan = distributeShaping(40, 45, 12)

    expect(plan.to).toBe(45)
    expect(sum(plan.schedule.map((row) => row.delta))).toBe(5)
  })

  it('refuses a section with no rows', () => {
    expect(() => distributeShaping(10, 20, 0)).toThrow(/au moins 1/)
  })
})
