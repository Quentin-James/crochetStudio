import { useId } from 'react'
import type { Project, ProjectCategory } from '../../core/types'
import './ProjectPreview.css'

interface ProjectPreviewProps {
  project: Project
  /** Larger silhouette for the detail page. */
  size?: 'card' | 'large'
}

/**
 * A silhouette preview drawn from the project's own data.
 *
 * This is not stock art: the shape comes from the category, its proportions from
 * the project's real dimensions, and the colour from the chosen yarn. Phase 4
 * replaces it with a captured 3D thumbnail (`project.thumbnail`), which this
 * component already prefers when one exists.
 */
export function ProjectPreview({ project, size = 'card' }: ProjectPreviewProps) {
  const patternId = useId().replace(/:/g, '')

  if (project.thumbnail) {
    return (
      <div className={`cs-preview cs-preview--${size}`}>
        <img src={project.thumbnail} alt={`Aperçu 3D de ${project.name}`} />
      </div>
    )
  }

  const { yarn } = project

  return (
    <div className={`cs-preview cs-preview--${size}`}>
      <svg viewBox="0 0 120 100" role="img" aria-label={`Silhouette de ${project.name}`}>
        <defs>
          {/* A V-stitch motif, scaled with the yarn's own strand diameter. */}
          <pattern
            id={`stitches-${patternId}`}
            width="8"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M1 1.5 4 4.5 7 1.5"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={Math.min(1.1, 0.35 + yarn.strandDiameterMm * 0.18)}
              strokeLinecap="round"
            />
          </pattern>
        </defs>

        <g>
          <path d={silhouette(project.category, aspectOf(project))} fill={yarn.color} />
          <path
            d={silhouette(project.category, aspectOf(project))}
            fill={`url(#stitches-${patternId})`}
          />
          {project.category === 'bag' && (
            <path
              d={handlePath(project)}
              fill="none"
              stroke={yarn.color}
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
    </div>
  )
}

/**
 * How wide the piece is relative to its height, from the stored dimensions.
 * Clamped so an extreme entry (a 3 m scarf) still renders a readable shape.
 */
function aspectOf(project: Project): number {
  const d = project.dimensions

  if (project.category === 'bag') {
    const width = d.width ?? 28
    const height = d.height ?? 24
    return clamp(width / height, 0.5, 1.8)
  }

  if (project.category === 'dress') {
    const width = d.width ?? 56
    const height = (d.bodiceLength ?? 38) + (d.skirtLength ?? 60)
    return clamp(width / height, 0.35, 1.1)
  }

  const width = d.width ?? 25
  const height = d.height ?? 150
  return clamp(width / height, 0.2, 2)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Silhouettes on a 120x100 canvas, widened or narrowed by the project's aspect. */
function silhouette(category: ProjectCategory, aspect: number): string {
  const cx = 60

  if (category === 'dress') {
    const shoulder = clamp(aspect * 26, 11, 26)
    const hem = clamp(aspect * 62, 24, 54)
    const waist = shoulder * 0.86
    return [
      `M ${cx - shoulder} 14`,
      `Q ${cx} 8 ${cx + shoulder} 14`,
      `L ${cx + waist} 44`,
      `L ${cx + hem} 90`,
      `Q ${cx} 96 ${cx - hem} 90`,
      `L ${cx - waist} 44`,
      'Z',
    ].join(' ')
  }

  if (category === 'bag') {
    const halfWidth = clamp(aspect * 30, 18, 42)
    const top = 36
    const bottom = 88
    return [
      `M ${cx - halfWidth} ${top}`,
      `L ${cx + halfWidth} ${top}`,
      `L ${cx + halfWidth * 0.86} ${bottom}`,
      `Q ${cx} ${bottom + 6} ${cx - halfWidth * 0.86} ${bottom}`,
      'Z',
    ].join(' ')
  }

  // Accessory: a folded rectangle of fabric with a soft edge.
  const halfWidth = clamp(aspect * 34, 16, 44)
  return [
    `M ${cx - halfWidth} 20`,
    `L ${cx + halfWidth} 20`,
    `L ${cx + halfWidth} 80`,
    `Q ${cx} 88 ${cx - halfWidth} 80`,
    'Z',
  ].join(' ')
}

/** Handle arc height tracks the project's handle drop. */
function handlePath(project: Project): string {
  const drop = clamp(project.dimensions.handleDrop ?? 28, 0, 60)
  const arcHeight = 34 - (drop / 60) * 22
  return `M 44 37 Q 60 ${arcHeight} 76 37`
}
