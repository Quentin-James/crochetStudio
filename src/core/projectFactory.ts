import { getCategory, pruneDimensions } from './categories'
import {
  DEFAULT_PATTERN,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  DEFAULT_SIZING,
  DEFAULT_THREE,
  PROJECT_SCHEMA_VERSION,
} from './defaults'
import { newId } from './ids'
import { YARN_WEIGHTS } from './stitches'
import type { AppSettings, Project, ProjectDraft } from './types'

/**
 * Project construction and cloning.
 *
 * Pure: it takes a draft plus the user's defaults and returns a complete
 * document. The repository only writes what this returns, so there is one
 * definition of what a new project looks like.
 */

export interface BuildProjectOptions {
  settings?: AppSettings
  /** Injected so tests are deterministic. */
  now?: number
  id?: string
}

export function buildProject(draft: ProjectDraft, options: BuildProjectOptions = {}): Project {
  const settings = options.settings ?? DEFAULT_SETTINGS
  const now = options.now ?? Date.now()
  const category = getCategory(draft.category)

  const yarn = { ...settings.defaultYarn, ...draft.yarn }
  // Keep strand diameter consistent with the weight unless the user set it.
  if (draft.yarn?.weight && draft.yarn.strandDiameterMm === undefined) {
    yarn.strandDiameterMm = YARN_WEIGHTS[draft.yarn.weight].strandDiameterMm
  }

  const dimensions = pruneDimensions(
    { ...category.defaults, ...draft.dimensions },
    draft.category,
  )

  return {
    id: options.id ?? newId(),
    name: draft.name.trim() === '' ? `${category.label} sans titre` : draft.name.trim(),
    category: draft.category,
    tags: [],
    createdAt: now,
    updatedAt: now,
    thumbnail: null,

    dimensions,
    gauge: { ...settings.defaultGauge, ...draft.gauge },
    yarn,
    sizing: { ...DEFAULT_SIZING, activeSize: settings.defaultSize },
    pattern: structuredCloneSafe(DEFAULT_PATTERN),
    three: { ...DEFAULT_THREE },
    notes: '',
    progress: { ...DEFAULT_PROGRESS },

    schemaVersion: PROJECT_SCHEMA_VERSION,
  }
}

/**
 * Copies a project under a new id and name.
 * Progress is intentionally reset: a duplicate is a fresh make, not a finished one.
 */
export function cloneProject(
  source: Project,
  options: { name?: string; now?: number; id?: string } = {},
): Project {
  const now = options.now ?? Date.now()
  return {
    ...structuredCloneSafe(source),
    id: options.id ?? newId(),
    name: options.name ?? nextCopyName(source.name),
    createdAt: now,
    updatedAt: now,
    progress: { ...DEFAULT_PROGRESS, totalRows: source.progress.totalRows },
  }
}

/** « Robe d’été » → « Robe d’été (copie) » → « Robe d’été (copie 2) ». */
export function nextCopyName(name: string): string {
  const match = /^(.*) \(copie(?: (\d+))?\)$/.exec(name)
  if (!match) return `${name} (copie)`
  const base = match[1] ?? name
  const current = match[2] ? Number.parseInt(match[2], 10) : 1
  return `${base} (copie ${current + 1})`
}

/** Makes a name unique against names already in the library. */
export function uniqueName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing)
  let candidate = name
  while (taken.has(candidate)) {
    candidate = nextCopyName(candidate)
  }
  return candidate
}

/**
 * `structuredClone` exists in all targets but not in every test runtime, and a
 * JSON round-trip is sufficient for these plain-data documents.
 */
function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}
