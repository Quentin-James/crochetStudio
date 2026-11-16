/**
 * The build roadmap, kept in one place so the dashboard reports real progress
 * rather than an invented percentage. Update `state` only when a phase is
 * genuinely finished and verified.
 */

export interface RoadmapPhase {
  number: number
  title: string
  summary: string
  state: 'done' | 'next' | 'planned'
}

export const ROADMAP: RoadmapPhase[] = [
  {
    number: 1,
    title: 'Architecture et atelier',
    summary: 'Charte graphique, navigation, modèle de données et base locale.',
    state: 'done',
  },
  {
    number: 2,
    title: 'Projets et sauvegarde',
    summary:
      'Créer, parcourir, dupliquer et supprimer des projets, avec enregistrement automatique et sauvegardes.',
    state: 'done',
  },
  {
    number: 3,
    title: 'Atelier de motifs',
    summary:
      'Éditeur de rangs, échantillon, tailles et moteur de calcul des mailles entièrement transparent.',
    state: 'done',
  },
  {
    number: 4,
    title: 'Atelier 3D',
    summary: 'Modèles interactifs en fil crocheté, générés depuis votre motif.',
    state: 'done',
  },
  {
    number: 5,
    title: 'Finitions et hors connexion',
    summary: 'Installation sur iPad, cache hors ligne, performances et ateliers redessinés.',
    state: 'done',
  },
]
