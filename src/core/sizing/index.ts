import type {
  Dimensions,
  MeasurementKey,
  Measurements,
  ProjectCategory,
  SizingState,
  StandardSize,
} from '../types'

/**
 * Size management.
 *
 * Standard sizes are body measurements in centimetres. They are deliberately
 * kept separate from garment dimensions: ease is applied when deriving one from
 * the other, so the user can see the difference between their body and the
 * finished piece.
 */

export const STANDARD_SIZES: StandardSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  bust: 'Tour de poitrine',
  waist: 'Tour de taille',
  hip: 'Tour de hanches',
  shoulderWidth: 'Largeur d’épaules',
  backLength: 'Longueur dos (nuque à taille)',
  armLength: 'Longueur de bras',
  armCircumference: 'Tour de bras',
  neckCircumference: 'Tour de cou',
}

export const MEASUREMENT_ORDER: MeasurementKey[] = [
  'bust',
  'waist',
  'hip',
  'shoulderWidth',
  'backLength',
  'armLength',
  'armCircumference',
  'neckCircumference',
]

/**
 * Body measurements per standard size, in centimetres.
 *
 * These follow common women's garment sizing (bust 82–114 cm). They are a
 * starting point, not a truth: every value is editable per project, and a custom
 * size profile replaces the table entirely.
 */
export const SIZE_TABLE: Record<StandardSize, Required<Measurements>> = {
  XS: {
    bust: 82,
    waist: 64,
    hip: 88,
    shoulderWidth: 36,
    backLength: 38,
    armLength: 57,
    armCircumference: 26,
    neckCircumference: 34,
  },
  S: {
    bust: 86,
    waist: 68,
    hip: 92,
    shoulderWidth: 37,
    backLength: 39,
    armLength: 58,
    armCircumference: 28,
    neckCircumference: 35,
  },
  M: {
    bust: 92,
    waist: 74,
    hip: 98,
    shoulderWidth: 39,
    backLength: 40,
    armLength: 59,
    armCircumference: 30,
    neckCircumference: 36,
  },
  L: {
    bust: 98,
    waist: 80,
    hip: 104,
    shoulderWidth: 41,
    backLength: 41,
    armLength: 60,
    armCircumference: 32,
    neckCircumference: 37,
  },
  XL: {
    bust: 106,
    waist: 88,
    hip: 112,
    shoulderWidth: 43,
    backLength: 42,
    armLength: 61,
    armCircumference: 35,
    neckCircumference: 39,
  },
  XXL: {
    bust: 114,
    waist: 96,
    hip: 120,
    shoulderWidth: 45,
    backLength: 43,
    armLength: 62,
    armCircumference: 38,
    neckCircumference: 40,
  },
}

/**
 * The measurements actually in force: the table for the active size, with any
 * per-size overrides the user typed applied on top.
 */
export function effectiveMeasurements(
  sizing: SizingState,
  customProfileMeasurements?: Measurements,
): Measurements {
  if (sizing.activeSize === 'custom') {
    return { ...(customProfileMeasurements ?? {}) }
  }

  const base = SIZE_TABLE[sizing.activeSize]
  const overrides = sizing.overrides[sizing.activeSize] ?? {}
  return { ...base, ...overrides }
}

/** True when the user has hand-edited any measurement for this size. */
export function hasOverrides(sizing: SizingState, size: StandardSize): boolean {
  return Object.keys(sizing.overrides[size] ?? {}).length > 0
}

/**
 * Derives finished garment dimensions from body measurements.
 *
 * Ease is added to circumferences only; lengths are taken as they are, because a
 * longer skirt is a design choice rather than a fit allowance. Bags and
 * accessories are not body-sized, so their dimensions are returned untouched —
 * switching size must not silently resize a handbag.
 */
export function deriveDimensions(
  category: ProjectCategory,
  measurements: Measurements,
  easeCm: number,
  current: Dimensions,
): Dimensions {
  if (category !== 'dress') return { ...current }

  const next: Dimensions = { ...current }

  if (measurements.bust !== undefined) {
    next.circumference = round1(measurements.bust + easeCm)
  }
  if (measurements.backLength !== undefined) {
    next.bodiceLength = round1(measurements.backLength)
  }
  if (measurements.hip !== undefined) {
    // The hem is measured flat, so it is half the circumference.
    next.width = round1((measurements.hip + easeCm) / 2)
  }
  // Skirt length is the user's design decision and is never derived.

  return next
}

export interface SizeComparisonRow {
  key: MeasurementKey
  label: string
  values: Record<StandardSize, number | undefined>
}

/** The full size table as rows, for the comparison view. */
export function compareSizes(sizing: SizingState): SizeComparisonRow[] {
  return MEASUREMENT_ORDER.map((key) => ({
    key,
    label: MEASUREMENT_LABELS[key],
    values: Object.fromEntries(
      // A hand-edited value wins over the table, which is what the user expects
      // to see when comparing sizes.
      STANDARD_SIZES.map((size) => [size, sizing.overrides[size]?.[key] ?? SIZE_TABLE[size][key]]),
    ) as Record<StandardSize, number | undefined>,
  }))
}

const round1 = (value: number) => Math.round(value * 10) / 10
