import { useLiveQuery } from 'dexie-react-hooks'
import type { Id, Project, ProjectCategory } from '../../core/types'
import { db } from '../../data/db'
import { getProject, listProjects } from '../../data/repositories/projectRepository'

export type SortKey = 'updated' | 'created' | 'name'
export type CategoryFilter = ProjectCategory | 'all'

export interface LibraryQuery {
  search: string
  category: CategoryFilter
  sort: SortKey
}

/**
 * Library filtering and sorting.
 *
 * Pure and exported so it can be unit-tested without a database: the number of
 * projects a single user keeps is small enough that filtering in memory is both
 * simpler and faster than maintaining compound indexes.
 */
export function filterAndSortProjects(
  projects: readonly Project[],
  query: LibraryQuery,
): Project[] {
  const needle = query.search.trim().toLowerCase()

  const filtered = projects.filter((project) => {
    if (query.category !== 'all' && project.category !== query.category) return false
    if (needle === '') return true

    return (
      project.name.toLowerCase().includes(needle) ||
      project.notes.toLowerCase().includes(needle) ||
      project.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
      project.yarn.name.toLowerCase().includes(needle)
    )
  })

  const sorted = [...filtered]
  switch (query.sort) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'created':
      sorted.sort((a, b) => b.createdAt - a.createdAt)
      break
    case 'updated':
      sorted.sort((a, b) => b.updatedAt - a.updatedAt)
      break
  }
  return sorted
}

export function countByCategory(
  projects: readonly Project[],
): Record<ProjectCategory, number> {
  const counts: Record<ProjectCategory, number> = { dress: 0, bag: 0, accessory: 0 }
  for (const project of projects) counts[project.category] += 1
  return counts
}

/** All projects, newest first, kept live as the database changes. */
export function useAllProjects(): Project[] | undefined {
  return useLiveQuery(() => listProjects(), [], undefined)
}

/** The `n` most recently edited projects, for the dashboard. */
export function useRecentProjects(limit: number): Project[] | undefined {
  return useLiveQuery(
    () => db.projects.orderBy('updatedAt').reverse().limit(limit).toArray(),
    [limit],
    undefined,
  )
}

/**
 * A single project. `undefined` means still loading; `null` means it does not
 * exist, which the detail page needs to distinguish to show a 'not found' state.
 */
export function useProject(id: Id | null): Project | null | undefined {
  return useLiveQuery(
    async () => {
      if (id === null) return null
      return (await getProject(id)) ?? null
    },
    [id],
    undefined,
  )
}
