import { DEFAULT_PATTERN, DEFAULT_THREE, PROJECT_SCHEMA_VERSION } from './defaults'
import type { Project } from './types'

/**
 * Lazy document migration.
 *
 * Projects are documents, so they are upgraded when read rather than in one
 * sweeping database migration: a project saved before palettes existed gains an
 * empty palette and null colour references the first time it is opened, and is
 * written back in the new shape on the next save.
 *
 * Pure and total: it must never throw on an old document, because the
 * alternative is a library that refuses to open.
 */
export function migrateProject(project: Project): Project {
  if (project.schemaVersion === PROJECT_SCHEMA_VERSION && project.yarn?.palette) {
    return project
  }

  return {
    ...project,
    yarn: {
      ...project.yarn,
      // v2 added a per-project colour palette.
      palette: project.yarn?.palette ?? [],
    },
    // v2 also added the viewport options; merging over the defaults means a new
    // setting arrives switched on rather than undefined.
    three: { ...DEFAULT_THREE, ...project.three },
    pattern: {
      // v2 also added the construction constraints.
      ...DEFAULT_PATTERN,
      ...project.pattern,
      sections: (project.pattern?.sections ?? []).map((section) => ({
        ...section,
        colorId: section.colorId ?? null,
        rows: (section.rows ?? []).map((row) => ({
          ...row,
          colorId: row.colorId ?? null,
        })),
      })),
    },
    schemaVersion: PROJECT_SCHEMA_VERSION,
  }
}

export const migrateProjects = (projects: readonly Project[]): Project[] =>
  projects.map(migrateProject)
