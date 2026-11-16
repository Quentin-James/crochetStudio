import { describe, expect, it } from 'vitest'
import { buildProject } from '../../core/projectFactory'
import type { Project } from '../../core/types'
import { countByCategory, filterAndSortProjects } from './useProjects'

const at = (offsetDays: number) => 1_763_000_000_000 + offsetDays * 86_400_000

function make(
  name: string,
  category: Project['category'],
  overrides: Partial<Project> = {},
): Project {
  return { ...buildProject({ name, category }, { now: at(0), id: name }), ...overrides }
}

const library: Project[] = [
  make('Garden party dress', 'dress', { updatedAt: at(3), createdAt: at(1) }),
  make('Market bag', 'bag', {
    updatedAt: at(5),
    createdAt: at(5),
    notes: 'Linen handles',
  }),
  make('Winter cowl', 'accessory', { updatedAt: at(1), createdAt: at(4) }),
]

describe('filterAndSortProjects', () => {
  const base = { search: '', category: 'all', sort: 'updated' } as const

  it('sorts by last edited, newest first, by default', () => {
    expect(filterAndSortProjects(library, base).map((p) => p.name)).toEqual([
      'Market bag',
      'Garden party dress',
      'Winter cowl',
    ])
  })

  it('sorts by creation date independently of edits', () => {
    expect(filterAndSortProjects(library, { ...base, sort: 'created' }).map((p) => p.name)).toEqual([
      'Market bag',
      'Winter cowl',
      'Garden party dress',
    ])
  })

  it('sorts by name', () => {
    expect(filterAndSortProjects(library, { ...base, sort: 'name' }).map((p) => p.name)).toEqual([
      'Garden party dress',
      'Market bag',
      'Winter cowl',
    ])
  })

  it('filters by category', () => {
    expect(filterAndSortProjects(library, { ...base, category: 'bag' }).map((p) => p.name)).toEqual([
      'Market bag',
    ])
  })

  it('searches names case-insensitively', () => {
    expect(filterAndSortProjects(library, { ...base, search: 'COWL' }).map((p) => p.name)).toEqual([
      'Winter cowl',
    ])
  })

  it('searches notes as well as names', () => {
    expect(filterAndSortProjects(library, { ...base, search: 'linen' }).map((p) => p.name)).toEqual([
      'Market bag',
    ])
  })

  it('combines a search with a category filter', () => {
    expect(
      filterAndSortProjects(library, { ...base, search: 'bag', category: 'dress' }),
    ).toEqual([])
  })

  it('does not mutate the array it was given', () => {
    const order = library.map((p) => p.name)
    filterAndSortProjects(library, { ...base, sort: 'name' })
    expect(library.map((p) => p.name)).toEqual(order)
  })
})

describe('countByCategory', () => {
  it('counts every category, including empty ones', () => {
    expect(countByCategory(library)).toEqual({ dress: 1, bag: 1, accessory: 1 })
    expect(countByCategory([])).toEqual({ dress: 0, bag: 0, accessory: 0 })
  })
})
