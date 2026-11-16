import type { IconName } from '../design/components'

export interface NavItem {
  path: string
  label: string
  /** Shorter label for the bottom tab bar on narrow iPad portrait layouts. */
  shortLabel: string
  icon: IconName
}

/** The five product sections. The single source for routes and for the nav UI. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Accueil', shortLabel: 'Accueil', icon: 'dashboard' },
  { path: '/projects', label: 'Mes projets', shortLabel: 'Projets', icon: 'projects' },
  { path: '/pattern', label: 'Atelier de motifs', shortLabel: 'Motifs', icon: 'pattern' },
  { path: '/3d', label: 'Atelier 3D', shortLabel: '3D', icon: 'cube' },
  { path: '/settings', label: 'Réglages', shortLabel: 'Réglages', icon: 'settings' },
]
