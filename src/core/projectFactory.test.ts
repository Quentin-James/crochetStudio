import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PROJECT_SCHEMA_VERSION } from './defaults'
import { buildProject, cloneProject, nextCopyName, uniqueName } from './projectFactory'
import { getCategory } from './categories'
import type { Project } from './types'

const NOW = 1_763_000_000_000

describe('buildProject', () => {
  it('fills a complete document from the category defaults', () => {
    const project = buildProject({ name: 'Garden party', category: 'dress' }, { now: NOW })

    expect(project.name).toBe('Garden party')
    expect(project.category).toBe('dress')
    expect(project.createdAt).toBe(NOW)
    expect(project.updatedAt).toBe(NOW)
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION)
    expect(project.dimensions).toEqual(getCategory('dress').defaults)
    expect(project.pattern.sections).toEqual([])
    expect(project.progress).toEqual({ completedRows: 0, totalRows: 0 })
  })

  it('names untitled projects after their category', () => {
    expect(buildProject({ name: '   ', category: 'bag' }, { now: NOW }).name).toBe('Sac sans titre')
  })

  it('keeps only the dimensions that belong to the category', () => {
    const project = buildProject(
      { name: 'Tote', category: 'bag', dimensions: { width: 30, skirtLength: 60 } },
      { now: NOW },
    )

    expect(project.dimensions.width).toBe(30)
    expect(project.dimensions.skirtLength).toBeUndefined()
  })

  it('takes gauge and yarn from the user settings', () => {
    const project = buildProject(
      { name: 'Scarf', category: 'accessory' },
      {
        now: NOW,
        settings: {
          ...DEFAULT_SETTINGS,
          defaultGauge: { ...DEFAULT_SETTINGS.defaultGauge, stitchCount: 17, hookSizeMm: 5 },
          defaultYarn: { ...DEFAULT_SETTINGS.defaultYarn, name: 'Linen blend' },
        },
      },
    )

    expect(project.gauge.stitchCount).toBe(17)
    expect(project.gauge.hookSizeMm).toBe(5)
    expect(project.yarn.name).toBe('Linen blend')
  })

  it('matches strand thickness to a yarn weight given in the draft', () => {
    const project = buildProject(
      { name: 'Chunky bag', category: 'bag', yarn: { weight: 'superBulky' } },
      { now: NOW },
    )

    expect(project.yarn.weight).toBe('superBulky')
    expect(project.yarn.strandDiameterMm).toBe(5.5)
  })
})

describe('cloneProject', () => {
  const source: Project = {
    ...buildProject({ name: 'Market bag', category: 'bag' }, { now: NOW, id: 'source' }),
    progress: { completedRows: 22, totalRows: 40 },
    notes: 'Second attempt at the base',
  }

  it('copies the design under a new id and name', () => {
    const copy = cloneProject(source, { now: NOW + 1000, id: 'copy' })

    expect(copy.id).toBe('copy')
    expect(copy.name).toBe('Market bag (copie)')
    expect(copy.notes).toBe(source.notes)
    expect(copy.dimensions).toEqual(source.dimensions)
    expect(copy.createdAt).toBe(NOW + 1000)
  })

  it('resets progress, because a duplicate is a fresh make', () => {
    const copy = cloneProject(source, { now: NOW })

    expect(copy.progress.completedRows).toBe(0)
    expect(copy.progress.totalRows).toBe(40)
  })

  it('does not share nested objects with the original', () => {
    const copy = cloneProject(source, { now: NOW })
    copy.gauge.stitchCount = 99
    copy.dimensions.width = 1

    expect(source.gauge.stitchCount).not.toBe(99)
    expect(source.dimensions.width).not.toBe(1)
  })
})

describe('copy naming', () => {
  it('numbers repeated copies', () => {
    expect(nextCopyName('Robe')).toBe('Robe (copie)')
    expect(nextCopyName('Robe (copie)')).toBe('Robe (copie 2)')
    expect(nextCopyName('Robe (copie 2)')).toBe('Robe (copie 3)')
  })

  it('finds the first name not already used', () => {
    expect(uniqueName('Robe', ['Robe', 'Robe (copie)'])).toBe('Robe (copie 2)')
    expect(uniqueName('Robe', [])).toBe('Robe')
  })
})
