import type { StitchDefinition, StitchId, YarnWeight } from '../types'

/**
 * The stitch catalogue, in French crochet terminology.
 *
 * The `usEquivalent` is carried because most patterns found online are written
 * in US terms, where the same word denotes a different stitch — a French "bride"
 * is a US "double crochet", not a US "treble".
 *
 * `heightRatio` is expressed against the single crochet / maille serrée and is
 * used only to *estimate* row height when the user has not swatched a given
 * stitch; a real swatched gauge always wins.
 */
export const STITCHES: Record<StitchId, StitchDefinition> = {
  ch: {
    id: 'ch',
    name: 'Maille en l’air',
    abbreviation: 'ml',
    usEquivalent: 'chain (ch)',
    heightRatio: 0.6,
    yarnRatio: 0.5,
    yarnOvers: 0,
    description: 'Maille de base et d’espacement. Forme la chaînette de départ.',
  },
  sl: {
    id: 'sl',
    name: 'Maille coulée',
    abbreviation: 'mc',
    usEquivalent: 'slip stitch (sl st)',
    heightRatio: 0.35,
    yarnRatio: 0.6,
    yarnOvers: 0,
    description: 'Ferme les tours et permet de se déplacer sans ajouter de hauteur.',
  },
  sc: {
    id: 'sc',
    name: 'Maille serrée',
    abbreviation: 'ms',
    usEquivalent: 'single crochet (sc)',
    heightRatio: 1,
    yarnRatio: 1,
    yarnOvers: 0,
    description: 'Tissu dense et ferme. Maille de référence pour les hauteurs.',
  },
  hdc: {
    id: 'hdc',
    name: 'Demi-bride',
    abbreviation: '1/2 br',
    usEquivalent: 'half double crochet (hdc)',
    heightRatio: 1.5,
    yarnRatio: 1.35,
    yarnOvers: 1,
    description: 'Un peu plus haute que la maille serrée, avec un tombé plus souple.',
  },
  dc: {
    id: 'dc',
    name: 'Bride',
    abbreviation: 'br',
    usEquivalent: 'double crochet (dc)',
    heightRatio: 2,
    yarnRatio: 1.7,
    yarnOvers: 1,
    description: 'Avance vite et donne un beau tombé. Très courante pour les vêtements.',
  },
  tr: {
    id: 'tr',
    name: 'Double bride',
    abbreviation: 'd-br',
    usEquivalent: 'treble crochet (tr)',
    heightRatio: 2.8,
    yarnRatio: 2.3,
    yarnOvers: 2,
    description: 'Haute et aérée. Produit un tissu léger, presque ajouré.',
  },
}

/** Display order used by pickers — utility stitches first, then shortest to tallest. */
export const STITCH_ORDER: StitchId[] = ['ch', 'sl', 'sc', 'hdc', 'dc', 'tr']

export const getStitch = (id: StitchId): StitchDefinition => STITCHES[id]

export const stitchList = (): StitchDefinition[] => STITCH_ORDER.map(getStitch)

/** Craft Yarn Council weight metadata, including the hook range each weight expects. */
export const YARN_WEIGHTS: Record<
  YarnWeight,
  { label: string; cycNumber: number; hookRangeMm: [number, number]; strandDiameterMm: number }
> = {
  lace: { label: 'Dentelle (0)', cycNumber: 0, hookRangeMm: [1.5, 2.25], strandDiameterMm: 0.5 },
  superFine: {
    label: 'Très fin (1)',
    cycNumber: 1,
    hookRangeMm: [2.25, 3.5],
    strandDiameterMm: 1,
  },
  fine: { label: 'Fin (2)', cycNumber: 2, hookRangeMm: [3.5, 4.5], strandDiameterMm: 1.5 },
  light: { label: 'Léger / DK (3)', cycNumber: 3, hookRangeMm: [4.5, 5.5], strandDiameterMm: 2 },
  medium: {
    label: 'Moyen / Aran (4)',
    cycNumber: 4,
    hookRangeMm: [5.5, 6.5],
    strandDiameterMm: 2.6,
  },
  bulky: { label: 'Épais (5)', cycNumber: 5, hookRangeMm: [6.5, 9], strandDiameterMm: 3.6 },
  superBulky: {
    label: 'Très épais (6)',
    cycNumber: 6,
    hookRangeMm: [9, 15],
    strandDiameterMm: 5.5,
  },
  jumbo: { label: 'Jumbo (7)', cycNumber: 7, hookRangeMm: [15, 25], strandDiameterMm: 9 },
}

export const YARN_WEIGHT_ORDER: YarnWeight[] = [
  'lace',
  'superFine',
  'fine',
  'light',
  'medium',
  'bulky',
  'superBulky',
  'jumbo',
]

/** Hook sizes in millimetres, as sold. */
export const HOOK_SIZES_MM = [
  2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 12, 15, 20, 25,
]

/** True when the hook falls inside the range normally recommended for the yarn. */
export function isHookInRange(hookSizeMm: number, weight: YarnWeight): boolean {
  const [min, max] = YARN_WEIGHTS[weight].hookRangeMm
  return hookSizeMm >= min && hookSizeMm <= max
}
