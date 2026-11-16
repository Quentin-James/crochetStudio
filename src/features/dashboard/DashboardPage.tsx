import { Link, useNavigate } from 'react-router-dom'
import { categoryList } from '../../core/categories'
import { formatRelative } from '../../core/dates'
import { formatBytes } from '../../core/units'
import { ROADMAP } from '../../app/roadmap'
import { useSettings } from '../../app/SettingsProvider'
import {
  Button,
  EmptyState,
  Icon,
  PageHeader,
  ProgressBar,
  Surface,
  Tag,
} from '../../design/components'
import { ProjectPreview } from '../projects/ProjectPreview'
import { summariseDimensions } from '../projects/ProjectCard'
import { countByCategory, useAllProjects, useRecentProjects } from '../projects/useProjects'
import { useStudioStatus } from './useStudioStatus'
import './DashboardPage.css'

const RECENT_LIMIT = 4

export function DashboardPage() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const recent = useRecentProjects(RECENT_LIMIT)
  const all = useAllProjects()
  const status = useStudioStatus()

  const counts = countByCategory(all ?? [])
  const hasProjects = (all?.length ?? 0) > 0
  const activeProject = all?.find((project) => project.id === settings.activeProjectId) ?? null

  const startNew = () => navigate('/projects?new=1')

  return (
    <>
      <PageHeader
        eyebrow="Votre atelier"
        title={hasProjects ? 'Bon retour' : 'Bienvenue dans Crochet Studio'}
        lede={
          hasProjects
            ? 'Reprenez où vous en étiez, ou commencez quelque chose de nouveau.'
            : 'Un coin tranquille pour créer au crochet : écrivez un motif, laissez votre échantillon faire les calculs, et voyez la pièce finie en 3D.'
        }
        actions={
          <Button variant="primary" icon="plus" size="lg" onClick={startNew}>
            Nouveau projet
          </Button>
        }
      />

      {all === undefined ? (
        <p className="cs-dash__muted">Chargement de votre atelier…</p>
      ) : !hasProjects ? (
        <EmptyState
          icon="yarn"
          title="Rien sur la table pour l’instant"
          description="Créez votre premier projet : Crochet Studio gardera ses mesures, son échantillon, son motif et vos notes ensemble, sur cet appareil."
          action={
            <Button variant="primary" icon="plus" onClick={startNew}>
              Créer un projet
            </Button>
          }
        />
      ) : (
        <section className="cs-dash__section">
          <header className="cs-dash__section-head">
            <h2 className="cs-dash__heading">Ouverts récemment</h2>
            <Link to="/projects" className="cs-dash__link">
              Tous mes projets
              <Icon name="chevronRight" size={15} />
            </Link>
          </header>

          <ul className="cs-dash__recent">
            {(recent ?? []).map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className="cs-dash__recent-card">
                  <ProjectPreview project={project} />
                  <div className="cs-dash__recent-body">
                    <h3>{project.name}</h3>
                    <p className="cs-dash__recent-meta">
                      {summariseDimensions(project, settings.units)}
                    </p>
                    <ProgressBar
                      completed={project.progress.completedRows}
                      total={project.progress.totalRows}
                      compact
                    />
                    <p className="cs-dash__recent-meta">
                      Modifié {formatRelative(project.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasProjects && (
        <section className="cs-dash__section">
          <h2 className="cs-dash__heading">Votre bibliothèque</h2>
          <ul className="cs-dash__categories">
            {categoryList().map((category) => (
              <li key={category.id}>
                <Link
                  to={`/projects?category=${category.id}`}
                  className="cs-dash__category"
                  style={{ ['--category-color' as string]: `var(${category.colorVar})` }}
                >
                  <span className="cs-dash__category-count">{counts[category.id]}</span>
                  <span className="cs-dash__category-label">{category.pluralLabel}</span>
                  <span className="cs-dash__category-description">{category.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="cs-dash__columns">
        <Surface padding="lg">
          <h2 className="cs-dash__heading">Plan de travail</h2>
          {activeProject ? (
            <>
              <p className="cs-dash__body">
                <Tag tone="accent">Ouvert</Tag> {activeProject.name} est chargé dans les ateliers.
              </p>
              <div className="cs-dash__desk-actions">
                <Button icon="pattern" onClick={() => navigate('/pattern')}>
                  Atelier de motifs
                </Button>
                <Button icon="cube" onClick={() => navigate('/3d')}>
                  Atelier 3D
                </Button>
              </div>
            </>
          ) : (
            <p className="cs-dash__body">
              Aucun projet n’est encore chargé dans les ateliers. Ouvrez-en un depuis votre
              bibliothèque et il vous attendra dans l’atelier de motifs et l’atelier 3D.
            </p>
          )}

          <dl className="cs-dash__facts">
            <div>
              <dt>Espace utilisé</dt>
              <dd>
                {status.state === 'ready' &&
                status.storage?.usageBytes !== null &&
                status.storage?.usageBytes !== undefined
                  ? formatBytes(status.storage.usageBytes)
                  : status.state === 'error'
                    ? 'Indisponible'
                    : 'Vérification…'}
              </dd>
            </div>
            <div>
              <dt>Dernière sauvegarde</dt>
              <dd>
                {settings.lastBackupAt === null ? (
                  <Link to="/settings" className="cs-dash__link">
                    Jamais — en exporter une
                  </Link>
                ) : (
                  formatRelative(settings.lastBackupAt)
                )}
              </dd>
            </div>
          </dl>

          {status.state === 'error' && (
            <p className="cs-dash__error">
              La base locale n’a pas pu être ouverte : rien ne peut être enregistré sur cet
              appareil.
              <br />
              <span className="cs-dash__mono">{status.error}</span>
            </p>
          )}
        </Surface>

        <Surface padding="lg">
          <h2 className="cs-dash__heading">Avancement du développement</h2>
          <ol className="cs-dash__phases">
            {ROADMAP.map((phase) => (
              <li key={phase.number} className={`cs-dash__phase cs-dash__phase--${phase.state}`}>
                <span className="cs-dash__phase-marker" aria-hidden="true">
                  {phase.state === 'done' ? <Icon name="check" size={14} /> : phase.number}
                </span>
                <span className="cs-dash__phase-text">
                  <span className="cs-dash__phase-title">
                    {phase.title}
                    {phase.state === 'next' && <em className="cs-dash__chip">en cours</em>}
                  </span>
                  <span className="cs-dash__phase-summary">{phase.summary}</span>
                </span>
              </li>
            ))}
          </ol>
        </Surface>
      </div>
    </>
  )
}
