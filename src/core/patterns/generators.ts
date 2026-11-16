import { rowsForHeight, stitchesForWidth, widthForStitches } from '../gauge'
import { distributeShaping } from '../shaping'
import type {
  Derivation,
  DimensionKey,
  Dimensions,
  Gauge,
  Pattern,
  PatternRow,
  PatternSection,
  ProjectCategory,
  StitchId,
} from '../types'
import { createRow, createSection, EVEN } from './rows'

/**
 * Pattern generation from finished measurements.
 *
 * Generators only ever derive counts through `core/gauge`, so nothing here
 * invents a stitch count: change the gauge and every number below moves with it.
 * Each generator reports the derivations it used and any warning the user needs
 * to know about (a missing measurement, shaping that won't fit).
 */

export interface GenerateInput {
  category: ProjectCategory
  dimensions: Dimensions
  gauge: Gauge
  /** The stitch the piece is worked in; defaults to the gauge swatch stitch. */
  stitch?: StitchId
  repeat?: number
  edgeStitches?: number
  /** Floor applied to every calculated round. */
  minStitches?: number
  /** Stitches added or removed on each shaping row. */
  shapingStep?: number
}

export interface GenerateResult {
  pattern: Pattern
  derivations: Derivation[]
  warnings: string[]
}

/** Edging worked in single crochet, used to finish hems and openings. */
const EDGING_STITCH: StitchId = 'sc'
const EDGING_ROUNDS = 2

export function generatePattern(input: GenerateInput): GenerateResult {
  switch (input.category) {
    case 'dress':
      return generateDress(input)
    case 'bag':
      return generateBag(input)
    case 'accessory':
      return generateAccessory(input)
  }
}

/* -------------------------------------------------------------------- dress -- */

function generateDress(input: GenerateInput): GenerateResult {
  const { gauge, dimensions } = input
  const stitch = input.stitch ?? gauge.stitch
  const repeat = input.repeat ?? 1
  const warnings: string[] = []
  const derivations: Derivation[] = []
  const sections: PatternSection[] = []

  const floor = Math.max(repeat, input.minStitches ?? 0)
  const step = input.shapingStep ?? 6

  const bust = require_(dimensions, 'circumference', 'Tour de poitrine', warnings)
  const bodiceLength = require_(dimensions, 'bodiceLength', 'Longueur du corsage', warnings)
  const skirtLength = require_(dimensions, 'skirtLength', 'Longueur de la jupe', warnings)
  const hemFlat = dimensions.width

  if (bust === null || bodiceLength === null) {
    return { pattern: emptyPattern(input), derivations, warnings }
  }

  // Bodice: a tube worked in the round, straight.
  const bodiceStitches = stitchesForWidth(bust, gauge, {
    repeat,
    requireEven: true,
    minimum: floor,
  })
  derivations.push(label(bodiceStitches.derivation, 'Corsage — mailles du tour'))

  const bodiceRows = rowsForHeight(bodiceLength, gauge, { minimum: 1 })
  derivations.push(label(bodiceRows.derivation, 'Corsage — rangs'))

  sections.push(
    createSection(
      'Corsage',
      'inTheRound',
      straightRows(bodiceRows.count, bodiceStitches.count, stitch),
      {
        notes:
          'Travaillé en rond du haut vers le bas. Fermez chaque tour par une maille coulée ou ' +
          'travaillez en spirale selon votre habitude.',
        generatedBy: 'dress/bodice',
      },
    ),
  )

  // Skirt: widens from the bodice to the hem.
  if (skirtLength !== null) {
    const hemCircumference = hemFlat !== undefined ? hemFlat * 2 : bust * 1.4
    if (hemFlat === undefined) {
      warnings.push(
        'La largeur d’ourlet n’est pas renseignée : la jupe s’évase de 40 % par défaut. ' +
          'Indiquez une largeur d’ourlet pour contrôler l’ampleur.',
      )
    }

    const hemStitches = stitchesForWidth(hemCircumference, gauge, {
      repeat,
      requireEven: true,
      minimum: floor,
    })
    derivations.push(label(hemStitches.derivation, 'Jupe — mailles à l’ourlet'))

    const skirtRows = rowsForHeight(skirtLength, gauge, { minimum: 1 })
    derivations.push(label(skirtRows.derivation, 'Jupe — rangs'))

    // The shaping step spreads the flare; six per round leaves no visible seam.
    const plan = distributeShaping(bodiceStitches.count, hemStitches.count, skirtRows.count, {
      stepPerRow: step,
    })
    derivations.push(label(plan.derivation, 'Jupe — façonnage'))
    warnings.push(...plan.warnings)

    sections.push(
      createSection('Jupe', 'inTheRound', rowsFromPlan(plan.schedule, stitch), {
        notes:
          'Les augmentations sont réparties régulièrement sur le tour. Marquez chaque point ' +
          'd’augmentation pour les aligner d’un tour à l’autre.',
        generatedBy: 'dress/skirt',
      }),
    )

    sections.push(edging(hemStitches.count, 'Bordure de l’ourlet', 'dress/edging'))
  }

  return { pattern: patternOf(sections, input), derivations, warnings }
}

/* ---------------------------------------------------------------------- bag -- */

function generateBag(input: GenerateInput): GenerateResult {
  const { gauge, dimensions } = input
  const stitch = input.stitch ?? gauge.stitch
  const repeat = input.repeat ?? 1
  const warnings: string[] = []
  const derivations: Derivation[] = []
  const sections: PatternSection[] = []

  const floor = Math.max(repeat, input.minStitches ?? 0)
  const step = input.shapingStep ?? 6

  const width = require_(dimensions, 'width', 'Largeur', warnings)
  const height = require_(dimensions, 'height', 'Hauteur', warnings)
  const depth = dimensions.depth ?? 0
  const handleDrop = dimensions.handleDrop ?? 0

  if (width === null || height === null) {
    return { pattern: emptyPattern(input), derivations, warnings }
  }

  if (depth > 0) {
    // Oval base: a straight run of (width − depth) with a half-circle at each end,
    // so its perimeter is π × depth + 2 × (width − depth).
    const straight = Math.max(0, width - depth)
    const foundation = stitchesForWidth(straight, gauge, { minimum: 2 })
    derivations.push(label(foundation.derivation, 'Base — chaînette de départ'))

    const perimeterCm = Math.PI * depth + 2 * straight
    const basePerimeter = stitchesForWidth(perimeterCm, gauge, {
      repeat,
      requireEven: true,
      minimum: floor,
    })
    derivations.push(label(basePerimeter.derivation, 'Base — mailles du pourtour'))

    const baseRounds = rowsForHeight(depth / 2, gauge, { minimum: 1 })
    derivations.push(label(baseRounds.derivation, 'Base — tours'))

    // Both sides of the foundation chain are worked, hence twice the chain.
    const plan = distributeShaping(foundation.count * 2, basePerimeter.count, baseRounds.count, {
      stepPerRow: step,
      skipFirstRow: false,
    })
    derivations.push(label(plan.derivation, 'Base — augmentations'))
    warnings.push(...plan.warnings)

    sections.push(
      createSection(
        'Base ovale',
        'inTheRound',
        [
          createRow({
            index: 1,
            stitch: 'ch',
            stitchCount: foundation.count,
            instruction: `Chaînette de ${foundation.count} ml`,
          }),
          ...rowsFromPlan(plan.schedule, stitch, 1),
        ],
        {
          notes:
            'Travaillez de part et d’autre de la chaînette. Les augmentations se font aux deux ' +
            'extrémités arrondies.',
          generatedBy: 'bag/base',
        },
      ),
    )

    sections.push(body(height, basePerimeter.count, stitch, gauge, derivations))
    sections.push(edging(basePerimeter.count, 'Bordure de l’ouverture', 'bag/edging'))
  } else {
    // Flat bag: a tube worked in the round and seamed along the bottom.
    warnings.push(
      'Profondeur à 0 : le sac est travaillé en tube puis cousu au fond. Indiquez une ' +
        'profondeur pour obtenir une base ovale.',
    )

    const circumference = stitchesForWidth(width * 2, gauge, {
      repeat,
      requireEven: true,
      minimum: floor,
    })
    derivations.push(label(circumference.derivation, 'Corps — mailles du tour'))

    sections.push(body(height, circumference.count, stitch, gauge, derivations))
    sections.push(edging(circumference.count, 'Bordure de l’ouverture', 'bag/edging'))
  }

  if (handleDrop > 0) {
    // A shoulder strap travels down and back up, so it is twice the drop.
    // Its width is the user's; 3 cm is only the fallback for a project saved
    // before the measurement existed.
    const strapWidthCm = dimensions.strapWidth ?? 3
    const strapStitches = stitchesForWidth(strapWidthCm, gauge, { minimum: 2 })
    derivations.push(label(strapStitches.derivation, 'Bandoulière — largeur en mailles'))

    const strapRows = rowsForHeight(handleDrop * 2, gauge, { minimum: 1 })
    derivations.push(label(strapRows.derivation, 'Bandoulière — rangs'))

    sections.push(
      createSection('Bandoulière', 'flat', straightRows(strapRows.count, strapStitches.count, stitch), {
        notes: `Bande droite d’environ ${round1(
          widthForStitches(strapStitches.count, gauge),
        )} cm de large, cousue de chaque côté de l’ouverture.`,
        generatedBy: 'bag/strap',
      }),
    )
  } else {
    warnings.push('Hauteur d’anse à 0 : aucune bandoulière n’a été générée.')
  }

  return { pattern: patternOf(sections, input), derivations, warnings }
}

/* ---------------------------------------------------------------- accessory -- */

function generateAccessory(input: GenerateInput): GenerateResult {
  const { gauge, dimensions } = input
  const stitch = input.stitch ?? gauge.stitch
  const repeat = input.repeat ?? 1
  const edgeStitches = input.edgeStitches ?? 0
  const warnings: string[] = []
  const derivations: Derivation[] = []

  const floor = Math.max(repeat, input.minStitches ?? 0)

  const width = require_(dimensions, 'width', 'Largeur', warnings)
  const height = require_(dimensions, 'height', 'Hauteur', warnings)
  const circumference = dimensions.circumference ?? 0

  if (width === null || height === null) {
    return { pattern: emptyPattern(input), derivations, warnings }
  }

  const inTheRound = circumference > 0
  const acrossCm = inTheRound ? circumference : width

  const stitches = stitchesForWidth(acrossCm, gauge, {
    repeat,
    edgeStitches: inTheRound ? 0 : edgeStitches,
    requireEven: inTheRound,
    minimum: floor,
  })
  derivations.push(
    label(stitches.derivation, inTheRound ? 'Mailles du tour' : 'Mailles du rang'),
  )

  const rows = rowsForHeight(height, gauge, { minimum: 1 })
  derivations.push(label(rows.derivation, 'Rangs'))

  const foundation = createRow({
    index: 1,
    stitch: 'ch',
    stitchCount: stitches.count + (inTheRound ? 0 : 1),
    instruction: inTheRound
      ? `Chaînette de ${stitches.count} ml, fermée en rond`
      : `Chaînette de ${stitches.count + 1} ml`,
  })

  const section = createSection(
    inTheRound ? 'Tube' : 'Panneau',
    inTheRound ? 'inTheRound' : 'flat',
    [foundation, ...straightRows(rows.count, stitches.count, stitch, 1)],
    {
      notes: inTheRound
        ? 'Travaillé en rond, sans façonnage.'
        : 'Travaillé à plat, en allers-retours.',
      generatedBy: 'accessory/panel',
    },
  )

  return { pattern: patternOf([section], input), derivations, warnings }
}

/* ------------------------------------------------------------------ helpers -- */

function body(
  heightCm: number,
  stitchCount: number,
  stitch: StitchId,
  gauge: Gauge,
  derivations: Derivation[],
): PatternSection {
  const rows = rowsForHeight(heightCm, gauge, { minimum: 1 })
  derivations.push(label(rows.derivation, 'Corps — tours'))

  return createSection('Corps', 'inTheRound', straightRows(rows.count, stitchCount, stitch), {
    notes: 'Travaillé droit, sans augmentation.',
    generatedBy: 'bag/body',
  })
}

function edging(stitchCount: number, name: string, generatedBy: string): PatternSection {
  return createSection(
    name,
    'inTheRound',
    straightRows(EDGING_ROUNDS, stitchCount, EDGING_STITCH),
    {
      notes: 'Finition en mailles serrées pour stabiliser le bord.',
      generatedBy,
    },
  )
}

/** `offset` lets a section start numbering after a foundation chain row. */
function straightRows(
  count: number,
  stitchCount: number,
  stitch: StitchId,
  offset = 0,
): PatternRow[] {
  return Array.from({ length: count }, (_unused, position) =>
    createRow({
      index: offset + position + 1,
      stitch,
      stitchCount,
      shaping: EVEN,
    }),
  )
}

function rowsFromPlan(
  schedule: readonly { row: number; delta: number; total: number }[],
  stitch: StitchId,
  offset = 0,
): PatternRow[] {
  return schedule.map((entry) =>
    createRow({
      index: offset + entry.row,
      stitch,
      stitchCount: entry.total,
      shaping:
        entry.delta === 0
          ? EVEN
          : { kind: entry.delta > 0 ? 'increase' : 'decrease', delta: entry.delta },
    }),
  )
}

/** Reads a required dimension, recording a warning when it is missing. */
function require_(
  dimensions: Dimensions,
  key: DimensionKey,
  label_: string,
  warnings: string[],
): number | null {
  const value = dimensions[key]
  if (value === undefined || value <= 0) {
    warnings.push(`La mesure « ${label_} » est absente : la génération est incomplète.`)
    return null
  }
  return value
}

const label = (derivation: Derivation, text: string): Derivation => ({
  ...derivation,
  label: text,
})

/** Carries the construction constraints onto the pattern that was built with them. */
const patternOf = (sections: PatternSection[], input: GenerateInput): Pattern => ({
  sections,
  repeat: input.repeat ?? 1,
  edgeStitches: input.edgeStitches ?? 0,
  minStitches: input.minStitches ?? 0,
  shapingStep: input.shapingStep ?? 6,
})

const emptyPattern = (input: GenerateInput): Pattern => patternOf([], input)

const round1 = (value: number) => Math.round(value * 10) / 10
