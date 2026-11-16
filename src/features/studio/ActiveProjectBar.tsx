import { Link } from 'react-router-dom'
import { getCategory } from '../../core/categories'
import type { Project, UnitSystem } from '../../core/types'
import { Icon, Surface, Tag } from '../../design/components'
import { ProjectPreview } from '../projects/ProjectPreview'
import { summariseDimensions } from '../projects/ProjectCard'
import './ActiveProjectBar.css'

interface ActiveProjectBarProps {
  project: Project | null | undefined
  units: UnitSystem
}

/**
 * Shows which project the studio workspaces are working on.
 *
 * The workspaces themselves arrive in phases 3 and 4; this bar is the real
 * plumbing between the library and those workspaces, and it reports the actual
 * stored state — including "nothing loaded".
 */
export function ActiveProjectBar({ project, units }: ActiveProjectBarProps) {
  if (project === undefined) {
    return (
      <Surface padding="md" className="cs-active">
        <p className="cs-active__empty">Recherche du projet ouvert…</p>
      </Surface>
    )
  }

  if (project === null) {
    return (
      <Surface tone="sunken" padding="md" className="cs-active">
        <p className="cs-active__empty">
          Aucun projet chargé.{' '}
          <Link to="/projects" className="cs-active__link">
            En ouvrir un depuis la bibliothèque
            <Icon name="chevronRight" size={14} />
          </Link>
        </p>
      </Surface>
    )
  }

  const category = getCategory(project.category)

  return (
    <Surface padding="sm" className="cs-active">
      <div className="cs-active__preview">
        <ProjectPreview project={project} />
      </div>
      <div className="cs-active__text">
        <p className="cs-active__eyebrow">En cours</p>
        <h2 className="cs-active__name">{project.name}</h2>
        <div className="cs-active__meta">
          <Tag colorVar={category.colorVar}>{category.label}</Tag>
          <span>{summariseDimensions(project, units)}</span>
          <span>
            Échantillon {project.gauge.stitchCount} m × {project.gauge.rowCount} rangs pour{' '}
            {project.gauge.swatchWidthCm} × {project.gauge.swatchHeightCm} cm
          </span>
        </div>
      </div>
      <Link to={`/projects/${project.id}`} className="cs-active__link">
        Fiche du projet
        <Icon name="chevronRight" size={14} />
      </Link>
    </Surface>
  )
}
