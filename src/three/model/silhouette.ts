import { resolveRowColor, resolveSectionColor, rowStitchColors } from '../../core/colors'
import { rowsPerCm, stitchesPerCm } from '../../core/gauge'
import { STITCHES } from '../../core/stitches'
import type { Gauge, Pattern, PatternSection, Project, StitchId } from '../../core/types'

/**
 * Pattern → geometry specification.
 *
 * This is the link the specification insists on: the 3D model is *not* a
 * decorative asset. Every ring below has its radius from a real round's stitch
 * count divided by the gauge, and its height from the row's stitch height. Change
 * a stitch count and the silhouette changes with it.
 *
 * Pure TypeScript — no Three.js here, so the maths is testable without a GPU.
 */

export interface Ring {
  /** Height above the base, in centimetres. */
  y: number
  /** Radius, in centimetres. */
  radius: number
  /** Stitches in the round this ring came from, for the stitch texture. */
  stitches: number
  /** Hex colour resolved from the row, its section, then the main yarn colour. */
  color: string
  /**
   * Resolved colour of each stitch in the round, when the row carries
   * colourwork. Null — the usual case — means every stitch uses `color`.
   */
  stitchColors: string[] | null
}

export interface PanelShape {
  widthCm: number
  heightCm: number
  color: string
}

export interface StrapShape {
  lengthCm: number
  widthCm: number
  color: string
}

export type ModelKind = 'revolution' | 'panel'

export interface ModelSpec {
  kind: ModelKind
  /** Bottom-to-top rings for a body of revolution. Empty for a flat panel. */
  rings: Ring[]
  panel: PanelShape | null
  strap: StrapShape | null
  /** Horizontal squash: 1 is circular, 0.3 is a flat oval. */
  depthRatio: number
  /** True when the bottom is closed (a bag's base) rather than an open hem. */
  closedBase: boolean
  /** Stitches around the widest round — drives the stitch texture density. */
  stitchesAround: number
  /** Total rows represented by the model. */
  rowCount: number
  totalHeightCm: number
  maxRadiusCm: number
  /** Whether the shape came from the pattern or only from the measurements. */
  source: 'pattern' | 'dimensions'
  warnings: string[]
}

/** Sections whose rounds grow outwards (a flat bottom) rather than upwards. */
const RADIAL_SECTIONS = new Set(['bag/base'])
/** Sections that are a separate strip rather than part of the body. */
const STRAP_SECTIONS = new Set(['bag/strap'])

/**
 * Builds the model specification for a project.
 *
 * Uses the pattern when there is one — that is the whole point — and falls back
 * to the raw measurements when the pattern has not been generated yet, saying so
 * in `source` rather than pretending.
 */
export function buildModelSpec(project: Project): ModelSpec {
  const density = safeDensity(project.gauge)

  if (!density) {
    return {
      ...fromDimensions(project),
      warnings: [
        'L’échantillon est incomplet : le modèle est approximatif tant que la largeur et la ' +
          'hauteur de l’échantillon ne sont pas renseignées.',
      ],
    }
  }

  if (project.pattern.sections.length === 0) {
    return {
      ...fromDimensions(project),
      warnings: [
        'Aucun motif généré : le volume vient directement des mesures. Générez le motif dans ' +
          'l’atelier pour que le modèle suive les mailles rang par rang.',
      ],
    }
  }

  return fromPattern(project, density)
}

interface Density {
  stitchesPerCm: number
  rowsPerCm: number
}

/* ------------------------------------------------------------ from pattern -- */

function fromPattern(project: Project, density: Density): ModelSpec {
  const { pattern, gauge } = project
  const warnings: string[] = []

  // A dress is worked from the shoulders down, a bag and a tube from the base up.
  const topDown = project.category === 'dress'

  const rings: Ring[] = []
  let panel: PanelShape | null = null
  let strap: StrapShape | null = null
  let cursor = 0
  let rowCount = 0

  for (const section of orderedSections(pattern, topDown)) {
    if (section.generatedBy !== null && STRAP_SECTIONS.has(section.generatedBy)) {
      strap = strapFromSection(section, gauge, density, resolveSectionColor(project.yarn, section))
      rowCount += section.rows.length
      continue
    }

    if (section.direction === 'flat' && section.generatedBy !== 'bag/strap') {
      // A flat section is a panel: the widest row is its width, the rows its height.
      const shape = panelFromSection(
        section,
        gauge,
        density,
        resolveSectionColor(project.yarn, section),
      )
      if (shape) panel = biggestPanel(panel, shape)
      rowCount += section.rows.length
      continue
    }

    const radial = section.generatedBy !== null && RADIAL_SECTIONS.has(section.generatedBy)

    for (const row of orderedRows(section, topDown)) {
      rowCount += 1
      const circumference = row.stitchCount / density.stitchesPerCm
      const radius = circumference / (2 * Math.PI)
      // The model shows the colour the row is actually worked in, stitch by
      // stitch when the row carries colourwork.
      const color = resolveRowColor(project.yarn, section, row)
      const stitchColors = rowStitchColors(project.yarn, section, row)

      if (radial) {
        // The base lies flat: successive rounds move outwards, not upwards, with
        // a slight lift so the bottom is not perfectly sharp-edged.
        rings.push({
          y: cursor + radius * 0.06,
          radius,
          stitches: row.stitchCount,
          color,
          stitchColors,
        })
        continue
      }

      // Rings sit at the *top* of each row, so the very first row needs an
      // opening ring at its base — otherwise the model is one row too short.
      if (rings.length === 0) {
        rings.push({ y: cursor, radius, stitches: row.stitchCount, color, stitchColors })
      }

      cursor += rowHeightCm(row.stitch, gauge, density)
      rings.push({ y: cursor, radius, stitches: row.stitchCount, color, stitchColors })
    }
  }

  if (rings.length < 2 && panel === null) {
    warnings.push('Le motif ne contient pas encore assez de rangs pour construire un volume.')
    return { ...fromDimensions(project), warnings }
  }

  if (rings.length >= 2) {
    normaliseBase(rings)
  }

  const maxRadius = rings.reduce((max, ring) => Math.max(max, ring.radius), 0)
  const stitchesAround = rings.reduce((max, ring) => Math.max(max, ring.stitches), 0)

  return {
    kind: rings.length >= 2 ? 'revolution' : 'panel',
    rings,
    panel,
    strap,
    depthRatio: depthRatioFor(project, maxRadius),
    // A bag is closed at the bottom — worked from a base, or seamed if flat.
    closedBase: project.category === 'bag',
    stitchesAround: stitchesAround || Math.round(maxRadius * 2 * Math.PI * density.stitchesPerCm),
    rowCount,
    totalHeightCm: rings.at(-1)?.y ?? panel?.heightCm ?? 0,
    maxRadiusCm: maxRadius,
    source: 'pattern',
    warnings,
  }
}

/** Pattern order is working order; geometry is built bottom-up. */
function orderedSections(pattern: Pattern, topDown: boolean): PatternSection[] {
  return topDown ? [...pattern.sections].reverse() : pattern.sections
}

function orderedRows(section: PatternSection, topDown: boolean) {
  return topDown ? [...section.rows].reverse() : section.rows
}

/**
 * Row height in centimetres.
 *
 * The gauge was swatched in one stitch; a row of a different stitch is taller or
 * shorter in proportion to its height ratio. A chain or slip-stitch round barely
 * adds height, which is why edgings do not stretch the model.
 */
function rowHeightCm(stitch: StitchId, gauge: Gauge, density: Density): number {
  const base = 1 / density.rowsPerCm
  const ratio = STITCHES[stitch].heightRatio / STITCHES[gauge.stitch].heightRatio
  return base * ratio
}

function panelFromSection(
  section: PatternSection,
  gauge: Gauge,
  density: Density,
  color: string,
): PanelShape | null {
  const workedRows = section.rows.filter((row) => row.stitch !== 'ch')
  if (workedRows.length === 0) return null

  const widest = workedRows.reduce((max, row) => Math.max(max, row.stitchCount), 0)
  const heightCm = workedRows.reduce(
    (total, row) => total + rowHeightCm(row.stitch, gauge, density),
    0,
  )

  return { widthCm: widest / density.stitchesPerCm, heightCm, color }
}

function strapFromSection(
  section: PatternSection,
  gauge: Gauge,
  density: Density,
  color: string,
): StrapShape | null {
  const shape = panelFromSection(section, gauge, density, color)
  if (!shape) return null
  // A strap is worked lengthwise: its rows are the length, its stitches the width.
  return { lengthCm: shape.heightCm, widthCm: shape.widthCm, color }
}

const biggestPanel = (current: PanelShape | null, candidate: PanelShape): PanelShape =>
  current === null || candidate.widthCm * candidate.heightCm > current.widthCm * current.heightCm
    ? candidate
    : current

/** Shifts the rings so the lowest sits at y = 0. */
function normaliseBase(rings: Ring[]): void {
  const lowest = rings.reduce((min, ring) => Math.min(min, ring.y), Number.POSITIVE_INFINITY)
  if (lowest === 0) return
  for (const ring of rings) ring.y -= lowest
}

/* --------------------------------------------------------- from dimensions -- */

function fromDimensions(project: Project): Omit<ModelSpec, 'warnings'> & { warnings: string[] } {
  const d = project.dimensions
  // Without a pattern there are no rows to colour, so the main yarn colour is used.
  const color = project.yarn.color

  /** A ring with no stitch count: there is no pattern to count stitches from. */
  const ring = (y: number, radius: number): Ring => ({
    y,
    radius,
    stitches: 0,
    color,
    stitchColors: null,
  })

  if (project.category === 'bag') {
    const width = d.width ?? 28
    const height = d.height ?? 24
    const depth = d.depth ?? 8
    const radius = width / 2
    const handleDrop = d.handleDrop ?? 0

    return {
      kind: 'revolution',
      rings: [ring(0, radius * 0.82), ring(height * 0.08, radius), ring(height, radius)],
      panel: null,
      strap:
        handleDrop > 0
          ? { lengthCm: handleDrop * 2, widthCm: d.strapWidth ?? 3, color }
          : null,
      depthRatio: depth > 0 ? clamp(depth / width, 0.18, 1) : 0.22,
      closedBase: true,
      stitchesAround: 0,
      rowCount: 0,
      totalHeightCm: height,
      maxRadiusCm: radius,
      source: 'dimensions',
      warnings: [],
    }
  }

  if (project.category === 'dress') {
    const bust = d.circumference ?? 92
    const bodice = d.bodiceLength ?? 38
    const skirt = d.skirtLength ?? 60
    const hemFlat = d.width ?? bust * 0.7
    const bustRadius = bust / (2 * Math.PI)
    const hemRadius = (hemFlat * 2) / (2 * Math.PI)

    return {
      kind: 'revolution',
      rings: [
        ring(0, hemRadius),
        ring(skirt * 0.55, lerp(hemRadius, bustRadius, 0.6)),
        ring(skirt, bustRadius),
        ring(skirt + bodice, bustRadius * 0.94),
      ],
      panel: null,
      strap: null,
      depthRatio: 0.78,
      closedBase: false,
      stitchesAround: 0,
      rowCount: 0,
      totalHeightCm: skirt + bodice,
      maxRadiusCm: Math.max(bustRadius, hemRadius),
      source: 'dimensions',
      warnings: [],
    }
  }

  const width = d.width ?? 25
  const height = d.height ?? 60
  const circumference = d.circumference ?? 0

  if (circumference > 0) {
    const radius = circumference / (2 * Math.PI)
    return {
      kind: 'revolution',
      rings: [ring(0, radius), ring(height, radius)],
      panel: null,
      strap: null,
      depthRatio: 1,
      closedBase: false,
      stitchesAround: 0,
      rowCount: 0,
      totalHeightCm: height,
      maxRadiusCm: radius,
      source: 'dimensions',
      warnings: [],
    }
  }

  return {
    kind: 'panel',
    rings: [],
    panel: { widthCm: width, heightCm: height, color },
    strap: null,
    depthRatio: 1,
    closedBase: false,
    stitchesAround: 0,
    rowCount: 0,
    totalHeightCm: height,
    maxRadiusCm: width / 2,
    source: 'dimensions',
    warnings: [],
  }
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * How oval the cross-section is.
 *
 * A bag's depth makes it genuinely oval; a dress is squashed slightly because a
 * body is not a cylinder.
 */
function depthRatioFor(project: Project, maxRadius: number): number {
  if (project.category === 'bag') {
    const depth = project.dimensions.depth ?? 0
    if (depth <= 0) return 0.22
    return clamp(depth / Math.max(1, maxRadius * 2), 0.18, 1)
  }
  if (project.category === 'dress') return 0.78
  return 1
}

function safeDensity(gauge: Gauge): Density | null {
  try {
    const stitches = stitchesPerCm(gauge)
    const rows = rowsPerCm(gauge)
    if (!Number.isFinite(stitches) || !Number.isFinite(rows) || stitches <= 0 || rows <= 0) {
      return null
    }
    return { stitchesPerCm: stitches, rowsPerCm: rows }
  } catch {
    return null
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const lerp = (from: number, to: number, t: number) => from + (to - from) * t
