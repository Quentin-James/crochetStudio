import type { DimensionKey, Dimensions, ProjectCategory } from './types'

/**
 * Category metadata.
 *
 * Which dimensions a project exposes depends on what it is: a dress is defined
 * by bust circumference and lengths, a bag by width/height/depth and a handle
 * drop. Generators in Phase 3 read the same definitions, so the creation form
 * and the pattern engine can never disagree about what a category needs.
 */

export interface DimensionDefinition {
  key: DimensionKey
  label: string
  /** Shown under the field to explain what to measure. */
  hint: string
  minCm: number
  maxCm: number
}

export interface CategoryDefinition {
  id: ProjectCategory
  label: string
  /** Plural, for filters and counts. */
  pluralLabel: string
  description: string
  dimensions: DimensionDefinition[]
  defaults: Dimensions
  /** CSS custom property holding this category's identity colour. */
  colorVar: string
}

const DRESS_DIMENSIONS: DimensionDefinition[] = [
  {
    key: 'circumference',
    // "fini" distinguishes this from the body measurement of the same name in
    // the size panel: one is the garment, the other is the person.
    label: 'Tour de poitrine fini',
    hint: 'Mesure du vêtement terminé, aisance comprise',
    minCm: 40,
    maxCm: 200,
  },
  {
    key: 'bodiceLength',
    label: 'Longueur du corsage',
    hint: 'De l’épaule à la taille',
    minCm: 15,
    maxCm: 80,
  },
  {
    key: 'skirtLength',
    label: 'Longueur de la jupe',
    hint: 'De la taille à l’ourlet',
    minCm: 10,
    maxCm: 150,
  },
  {
    key: 'width',
    label: 'Largeur d’ourlet (à plat)',
    hint: 'La moitié du tour d’ourlet, mesurée à plat',
    minCm: 20,
    maxCm: 150,
  },
]

const BAG_DIMENSIONS: DimensionDefinition[] = [
  { key: 'width', label: 'Largeur', hint: 'Sur le devant du sac', minCm: 5, maxCm: 100 },
  { key: 'height', label: 'Hauteur', hint: 'Du fond à l’ouverture', minCm: 5, maxCm: 100 },
  {
    key: 'depth',
    label: 'Profondeur',
    hint: 'D’avant en arrière ; 0 pour un sac plat',
    minCm: 0,
    maxCm: 60,
  },
  {
    key: 'handleDrop',
    label: 'Hauteur d’anse',
    hint: 'Du haut du sac au haut de la bandoulière',
    minCm: 0,
    maxCm: 90,
  },
  {
    key: 'strapWidth',
    label: 'Largeur de bandoulière',
    hint: 'Largeur de la bande, dans le fil et l’échantillon du projet',
    minCm: 1,
    maxCm: 15,
  },
]

const ACCESSORY_DIMENSIONS: DimensionDefinition[] = [
  { key: 'width', label: 'Largeur', hint: 'Mesurée à plat', minCm: 2, maxCm: 200 },
  { key: 'height', label: 'Hauteur', hint: 'Mesurée à plat', minCm: 2, maxCm: 200 },
  {
    key: 'circumference',
    label: 'Circonférence',
    hint: 'Laissez vide pour une pièce travaillée à plat',
    minCm: 0,
    maxCm: 200,
  },
]

export const CATEGORIES: Record<ProjectCategory, CategoryDefinition> = {
  dress: {
    id: 'dress',
    label: 'Robe',
    pluralLabel: 'Robes',
    description: 'Un corsage et une jupe, travaillés à plat ou en rond.',
    dimensions: DRESS_DIMENSIONS,
    defaults: { circumference: 92, bodiceLength: 38, skirtLength: 60, width: 56 },
    colorVar: '--cat-dress',
  },
  bag: {
    id: 'bag',
    label: 'Sac',
    pluralLabel: 'Sacs',
    description: 'Un corps travaillé en rond ou en panneaux, avec anses ou bandoulière.',
    dimensions: BAG_DIMENSIONS,
    defaults: { width: 28, height: 24, depth: 8, handleDrop: 28, strapWidth: 3 },
    colorVar: '--cat-bag',
  },
  accessory: {
    id: 'accessory',
    label: 'Accessoire',
    pluralLabel: 'Accessoires',
    description: 'Écharpes, bonnets, snoods et tout le reste.',
    dimensions: ACCESSORY_DIMENSIONS,
    defaults: { width: 25, height: 150 },
    colorVar: '--cat-accessory',
  },
}

export const CATEGORY_ORDER: ProjectCategory[] = ['dress', 'bag', 'accessory']

export const getCategory = (id: ProjectCategory): CategoryDefinition => CATEGORIES[id]

export const categoryList = (): CategoryDefinition[] => CATEGORY_ORDER.map(getCategory)

/**
 * Keeps only the dimensions that belong to a category, so switching a project's
 * category cannot leave a stale `handleDrop` on a dress.
 */
export function pruneDimensions(
  dimensions: Dimensions,
  category: ProjectCategory,
): Dimensions {
  const allowed = new Set(getCategory(category).dimensions.map((d) => d.key))
  const result: Dimensions = {}
  for (const [key, value] of Object.entries(dimensions)) {
    if (allowed.has(key as DimensionKey) && typeof value === 'number') {
      result[key as DimensionKey] = value
    }
  }
  return result
}
