import type { Derivation, DerivationAdjustment, Gauge } from '../types'

/**
 * The gauge engine.
 *
 * Every stitch and row count in the application comes from here, and every
 * result carries a `Derivation` describing how it was reached: the inputs, the
 * formula, the raw figure and each adjustment with its reason. The UI renders
 * that trail so the user can see why the answer is 80 rather than being told to
 * trust it.
 *
 * All lengths are centimetres (see `core/units`).
 */

export interface CountResult {
  count: number
  derivation: Derivation
}

export interface StitchCountOptions {
  /** The pattern repeat the count must be a multiple of. 1 means unconstrained. */
  repeat?: number
  /** Extra stitches outside the repeat, e.g. selvedge stitches. */
  edgeStitches?: number
  /** Structural minimum, e.g. a magic-ring start. */
  minimum?: number
  /** Forces an even count, needed when a panel is mirrored or seamed in pairs. */
  requireEven?: boolean
}

/** Stitches per centimetre, from the swatch as actually measured. */
export function stitchesPerCm(gauge: Gauge): number {
  assertPositive(gauge.swatchWidthCm, 'la largeur de l’échantillon')
  return gauge.stitchCount / gauge.swatchWidthCm
}

/** Rows per centimetre, from the swatch as actually measured. */
export function rowsPerCm(gauge: Gauge): number {
  assertPositive(gauge.swatchHeightCm, 'la hauteur de l’échantillon')
  return gauge.rowCount / gauge.swatchHeightCm
}

/**
 * Rounds a count to a whole number of stitches or rows.
 *
 * Half-up, applied in exactly one place so two screens can never disagree about
 * what 44.5 becomes.
 */
export function roundCount(value: number): number {
  return Math.floor(value + 0.5 + Number.EPSILON)
}

/** How many stitches a finished width needs. */
export function stitchesForWidth(
  widthCm: number,
  gauge: Gauge,
  options: StitchCountOptions = {},
): CountResult {
  const { repeat = 1, edgeStitches = 0, minimum = 1, requireEven = false } = options

  const density = stitchesPerCm(gauge)
  const raw = widthCm * density
  const adjustments: DerivationAdjustment[] = []

  let count = roundCount(raw)
  if (count !== raw) {
    adjustments.push({
      reason: 'Arrondi au nombre entier de mailles le plus proche',
      from: round2(raw),
      to: count,
    })
  }

  if (repeat > 1) {
    const body = Math.max(repeat, roundCount(count / repeat) * repeat)
    if (body !== count) {
      adjustments.push({
        reason: `Ajusté à un multiple du motif (${repeat} mailles)`,
        from: count,
        to: body,
      })
      count = body
    }
  }

  if (edgeStitches > 0) {
    const withEdges = count + edgeStitches
    adjustments.push({
      reason: `Ajout des mailles de lisière (${edgeStitches})`,
      from: count,
      to: withEdges,
    })
    count = withEdges
  }

  if (requireEven && count % 2 !== 0) {
    adjustments.push({
      reason: 'Nombre pair requis pour assembler les panneaux symétriquement',
      from: count,
      to: count + 1,
    })
    count += 1
  }

  if (count < minimum) {
    adjustments.push({
      reason: `Minimum structurel de ${minimum} mailles`,
      from: count,
      to: minimum,
    })
    count = minimum
  }

  return {
    count,
    derivation: {
      label: 'Mailles',
      formula: 'largeur × (mailles de l’échantillon ÷ largeur de l’échantillon)',
      inputs: {
        'largeur (cm)': round2(widthCm),
        'mailles de l’échantillon': gauge.stitchCount,
        'largeur de l’échantillon (cm)': gauge.swatchWidthCm,
        'mailles par cm': round2(density),
      },
      rawResult: round2(raw),
      finalResult: count,
      adjustments,
    },
  }
}

/** How many rows a finished height needs. */
export function rowsForHeight(
  heightCm: number,
  gauge: Gauge,
  options: { minimum?: number } = {},
): CountResult {
  const { minimum = 1 } = options

  const density = rowsPerCm(gauge)
  const raw = heightCm * density
  const adjustments: DerivationAdjustment[] = []

  let count = roundCount(raw)
  if (count !== raw) {
    adjustments.push({
      reason: 'Arrondi au nombre entier de rangs le plus proche',
      from: round2(raw),
      to: count,
    })
  }

  if (count < minimum) {
    adjustments.push({
      reason: `Minimum de ${minimum} rang(s)`,
      from: count,
      to: minimum,
    })
    count = minimum
  }

  return {
    count,
    derivation: {
      label: 'Rangs',
      formula: 'hauteur × (rangs de l’échantillon ÷ hauteur de l’échantillon)',
      inputs: {
        'hauteur (cm)': round2(heightCm),
        'rangs de l’échantillon': gauge.rowCount,
        'hauteur de l’échantillon (cm)': gauge.swatchHeightCm,
        'rangs par cm': round2(density),
      },
      rawResult: round2(raw),
      finalResult: count,
      adjustments,
    },
  }
}

/** The finished width a stitch count actually produces — what the user will measure. */
export function widthForStitches(count: number, gauge: Gauge): number {
  return count / stitchesPerCm(gauge)
}

/** The finished height a row count actually produces. */
export function heightForRows(count: number, gauge: Gauge): number {
  return count / rowsPerCm(gauge)
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`L’échantillon est invalide : ${name} doit être supérieure à zéro.`)
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100
