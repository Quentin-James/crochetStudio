import { Link } from 'react-router-dom'
import { getCategory } from '../../core/categories'
import { formatRelative } from '../../core/dates'
import { formatLength } from '../../core/units'
import type { Project, UnitSystem } from '../../core/types'
import { Icon, ProgressBar, Tag } from '../../design/components'
import { ProjectPreview } from './ProjectPreview'
import './ProjectCard.css'

interface ProjectCardProps {
  project: Project
  units: UnitSystem
  onDuplicate: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectCard({ project, units, onDuplicate, onDelete }: ProjectCardProps) {
  const category = getCategory(project.category)

  return (
    <article className="cs-card">
      <Link to={`/projects/${project.id}`} className="cs-card__link">
        <ProjectPreview project={project} />
        <div className="cs-card__body">
          <div className="cs-card__heading">
            <h3 className="cs-card__name">{project.name}</h3>
            <Tag colorVar={category.colorVar}>{category.label}</Tag>
          </div>
          <p className="cs-card__meta">
            {summariseDimensions(project, units)}
            <span className="cs-card__dot">·</span>
            Modifié {formatRelative(project.updatedAt)}
          </p>
          <ProgressBar
            completed={project.progress.completedRows}
            total={project.progress.totalRows}
          />
        </div>
      </Link>

      <div className="cs-card__actions">
        <button
          type="button"
          className="cs-card__action"
          onClick={() => onDuplicate(project)}
          aria-label={`Dupliquer ${project.name}`}
          title="Dupliquer"
        >
          <Icon name="copy" size={17} />
        </button>
        <button
          type="button"
          className="cs-card__action cs-card__action--danger"
          onClick={() => onDelete(project)}
          aria-label={`Supprimer ${project.name}`}
          title="Supprimer"
        >
          <Icon name="trash" size={17} />
        </button>
      </div>
    </article>
  )
}

/** The dimensions that best describe this category, in the user's units. */
export function summariseDimensions(project: Project, units: UnitSystem): string {
  const d = project.dimensions

  if (project.category === 'dress') {
    const bust = d.circumference
    const length = (d.bodiceLength ?? 0) + (d.skirtLength ?? 0)
    const parts = [
      bust === undefined ? null : `${formatLength(bust, units)} de tour`,
      length === 0 ? null : `${formatLength(length, units)} de long`,
    ].filter((part): part is string => part !== null)

    return parts.length > 0 ? parts.join(' · ') : 'Mesures non renseignées'
  }

  const { width, height } = d
  if (width === undefined || height === undefined) return 'Mesures non renseignées'
  return `${formatLength(width, units, false)} × ${formatLength(height, units)}`
}
