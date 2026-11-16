import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategory } from '../../core/categories'
import { colorsInUse } from '../../core/colors'
import { STITCHES, YARN_WEIGHTS } from '../../core/stitches'
import { formatLength, unitLabel } from '../../core/units'
import type { Id, Project, RenderQuality, StitchRender, ThreeConfig } from '../../core/types'
import { buildModelSpec } from '../../three/model/silhouette'
import type { PresetView } from '../../three/scene/Viewport'
import {
  Button,
  EmptyState,
  Icon,
  Panel,
  SaveIndicator,
  SegmentedControl,
  Slider,
  StatusPill,
  Surface,
  Switch,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  type Segment,
} from '../../design/components'
import { useSettings } from '../../app/SettingsProvider'
import { DimensionFields } from '../projects/DimensionFields'
import { useProject } from '../projects/useProjects'
import { useProjectEditor } from '../projects/useProjectEditor'
import { PalettePanel } from '../studio/PalettePanel'
import { usePatternSync } from '../studio/usePatternSync'
import { ColorPlacement } from './ColorPlacement'
import { useViewport } from './useViewport'
import './Studio3DPage.css'

const VIEWS: { value: PresetView; label: string }[] = [
  { value: 'front', label: 'Face' },
  { value: 'threeQuarter', label: '3/4' },
  { value: 'left', label: 'Profil' },
  { value: 'back', label: 'Dos' },
  { value: 'top', label: 'Dessus' },
]

const BACKGROUND_SEGMENTS: Segment<ThreeConfig['backgroundTone']>[] = [
  { value: 'ivory', label: 'Ivoire' },
  { value: 'cream', label: 'Crème' },
  { value: 'brown', label: 'Brun' },
]

const QUALITY_SEGMENTS: Segment<RenderQuality>[] = [
  { value: 'standard', label: 'Fluide' },
  { value: 'high', label: 'Détaillée' },
]

const STITCH_RENDER_SEGMENTS: Segment<StitchRender>[] = [
  { value: 'geometry', label: 'Mailles en volume' },
  { value: 'texture', label: 'Relief peint' },
]

export function Studio3DPage() {
  const { settings } = useSettings()
  const stored = useProject(settings.activeProjectId)
  const { draft, status, lastSavedAt, update, saveNow } = useProjectEditor(stored ?? null)

  if (stored === undefined) {
    return <p className="cs-viewport__loading">Ouverture du projet…</p>
  }

  if (stored === null || draft === null) {
    return (
      <div className="cs-studio3d cs-studio3d--empty">
        <EmptyState
          icon="cube"
          title="Aucun projet ouvert"
          description="L’atelier 3D construit le modèle à partir du motif et des mesures d’un projet. Ouvrez-en un depuis votre bibliothèque."
          action={
            <Link to="/projects" className="cs-button cs-button--primary cs-button--md">
              <Icon name="projects" size={18} />
              <span>Voir mes projets</span>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <Studio3DContent
      project={draft}
      status={status}
      lastSavedAt={lastSavedAt}
      update={update}
      saveNow={saveNow}
    />
  )
}

interface ContentProps {
  project: Project
  status: ReturnType<typeof useProjectEditor>['status']
  lastSavedAt: number | null
  update: ReturnType<typeof useProjectEditor>['update']
  saveNow: () => Promise<void>
}

function Studio3DContent({ project, status, lastSavedAt, update, saveNow }: ContentProps) {
  const { settings } = useSettings()
  const units = settings.units
  const [captured, setCaptured] = useState(false)
  const [selectedColorId, setSelectedColorId] = useState<Id | null>(null)

  // Measurements can be edited here, so the pattern follows the same rules as in
  // the pattern editor: silent recalculation unless hand-edited rows are at stake.
  const sync = usePatternSync(project, update)

  // Colours live in the rings, so the yarn is part of what the geometry depends on.
  const spec = useMemo(
    () => buildModelSpec(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.pattern, project.dimensions, project.gauge, project.category, project.yarn],
  )

  const three = project.three
  const setThree = (patch: Partial<ThreeConfig>) => update({ three: { ...three, ...patch } })

  const viewport = useViewport({
    spec,
    yarn: project.yarn,
    three,
    projectId: project.id,
    onPoseSettled: (pose) =>
      update({
        three: {
          ...three,
          cameraAzimuth: pose.azimuth,
          cameraPolar: pose.polar,
          cameraDistance: pose.distance,
        },
      }),
  })

  const category = getCategory(project.category)
  const used = colorsInUse(project.yarn, project.pattern)

  const onCapture = () => {
    const dataUrl = viewport.capture()
    if (!dataUrl) return
    update({ thumbnail: dataUrl })
    setCaptured(true)
  }

  return (
    <div className="cs-studio3d">
      {/* ---- Workspace header -------------------------------------------- */}
      <header className="cs-studio3d__header">
        <div className="cs-studio3d__identity">
          <p className="cs-studio3d__eyebrow">Atelier 3D</p>
          <h1 className="cs-studio3d__title">{project.name}</h1>
          <div className="cs-studio3d__facts">
            <span>{category.label}</span>
            <span>
              {Object.entries(project.dimensions)
                .slice(0, 2)
                .map(([, value]) => formatLength(value as number, units))
                .join(' × ') || 'Mesures non renseignées'}
            </span>
            <span>
              {project.yarn.name} · {YARN_WEIGHTS[project.yarn.weight].label}
            </span>
            <span>
              Échantillon {project.gauge.stitchCount} m × {project.gauge.rowCount} r /{' '}
              {project.gauge.swatchWidthCm}×{project.gauge.swatchHeightCm} cm ·{' '}
              {STITCHES[project.gauge.stitch].abbreviation}
            </span>
            {spec.source === 'pattern' ? (
              <StatusPill tone="ok">Motif généré</StatusPill>
            ) : (
              <StatusPill tone="warning">Volume depuis les mesures</StatusPill>
            )}
          </div>
        </div>

        <div className="cs-studio3d__header-actions">
          <SaveIndicator status={status} lastSavedAt={lastSavedAt} />
          <Link to={`/projects/${project.id}`} className="cs-button cs-button--secondary cs-button--md">
            <Icon name="chevronLeft" size={18} />
            <span>Fiche projet</span>
          </Link>
          <Button onClick={() => void saveNow()} disabled={status === 'saving'}>
            Enregistrer
          </Button>
        </div>
      </header>

      {/* ---- Viewport + properties --------------------------------------- */}
      <div className="cs-studio3d__body">
        <section className="cs-studio3d__stage" aria-label="Vue 3D">
          {!viewport.supported || viewport.failure ? (
            <div className="cs-viewport__unavailable">
              <h2>La 3D n’est pas disponible sur ce navigateur</h2>
              <p>
                L’atelier 3D a besoin de WebGL. Il est peut-être désactivé dans les réglages du
                navigateur, ou indisponible sur cet appareil. Le reste de l’application fonctionne
                normalement.
              </p>
              {viewport.failure && <p className="cs-viewport__detail">{viewport.failure}</p>}
            </div>
          ) : (
            <>
              <div className="cs-studio3d__canvas-wrap" ref={viewport.containerRef}>
                <canvas ref={viewport.canvasRef} className="cs-studio3d__canvas" />

                <div className="cs-studio3d__overlay">
                  <span>{formatLength(spec.totalHeightCm, units)} de haut</span>
                  <span>{formatLength(spec.maxRadiusCm * 2, units)} au plus large</span>
                  {spec.stitchesAround > 0 && <span>{spec.stitchesAround} m / tour</span>}
                </div>
              </div>

              <Toolbar label="Outils de la vue 3D">
                <ToolbarGroup>
                  {VIEWS.map((view) => (
                    <ToolbarButton
                      key={view.value}
                      label={view.label}
                      onClick={() => viewport.setPreset(view.value)}
                    />
                  ))}
                </ToolbarGroup>

                <ToolbarSeparator />

                <ToolbarGroup>
                  <ToolbarButton
                    label="Zoom arrière"
                    icon="search"
                    iconOnly
                    onClick={() => viewport.zoomBy(1.25)}
                  />
                  <ToolbarButton label="Cadrer" icon="cube" onClick={viewport.fit} />
                  <ToolbarButton
                    label="Zoom avant"
                    icon="plus"
                    iconOnly
                    onClick={() => viewport.zoomBy(0.8)}
                  />
                </ToolbarGroup>

                <ToolbarSeparator />

                <ToolbarGroup>
                  <ToolbarButton
                    label="Grille"
                    icon="ruler"
                    pressed={three.showGrid}
                    onClick={() => setThree({ showGrid: !three.showGrid })}
                  />
                  <ToolbarButton
                    label="Filaire"
                    icon="pattern"
                    pressed={three.wireframe}
                    onClick={() => setThree({ wireframe: !three.wireframe })}
                  />
                </ToolbarGroup>

                <ToolbarSeparator />

                <ToolbarGroup>
                  <ToolbarButton label="Réinitialiser" icon="refresh" onClick={viewport.resetCamera} />
                </ToolbarGroup>
              </Toolbar>
            </>
          )}
        </section>

        <aside className="cs-studio3d__properties" aria-label="Propriétés du modèle">
          <Surface padding="none" className="cs-studio3d__panel-stack">
            <Panel
              title="Mesures"
              hint={`Dimensions du ${category.label.toLowerCase()} fini, en ${unitLabel(units)}`}
              aside={
                sync.isStale && sync.hasLockedRows ? (
                  <StatusPill tone="warning" compact>
                    à recalculer
                  </StatusPill>
                ) : undefined
              }
            >
              <div className="cs-studio3d__grid">
                <DimensionFields
                  category={project.category}
                  dimensions={project.dimensions}
                  units={units}
                  onChange={(dimensions) => update({ dimensions })}
                />
              </div>

              {sync.isStale && sync.hasLockedRows && (
                <div className="cs-studio3d__notice">
                  <p>
                    Le motif ne suit plus ces mesures. Vos rangs modifiés à la main sont conservés
                    tant que vous n’avez pas recalculé.
                  </p>
                  <Button size="sm" variant="primary" icon="refresh" onClick={sync.apply}>
                    Recalculer
                  </Button>
                </div>
              )}

              {sync.isEmpty && (
                <p className="cs-studio3d__hint">
                  Le volume vient des mesures : générez le motif dans l’atelier de motifs pour que
                  le modèle suive les mailles rang par rang.
                </p>
              )}
            </Panel>

            <Panel title="Fil" hint="Palette du projet et aspect du brin">
              <PalettePanel
                project={project}
                update={update}
                selectedId={selectedColorId}
                onSelect={setSelectedColorId}
              />

              <Slider
                label="Épaisseur du brin"
                value={three.yarnThicknessScale}
                min={0.4}
                max={2.5}
                step={0.1}
                display={`${three.yarnThicknessScale.toFixed(1).replace('.', ',')} ×`}
                onValueChange={(yarnThicknessScale) => setThree({ yarnThicknessScale })}
              />

              <p className="cs-studio3d__hint">
                Le brin fait {project.yarn.strandDiameterMm} mm d’après la grosseur du fil choisie ;
                ce réglage ne change que son rendu à l’écran.
              </p>
            </Panel>

            <Panel title="Placement des couleurs" hint="Sections et rayures" collapsible>
              <ColorPlacement
                project={project}
                update={update}
                selectedColorId={selectedColorId}
              />
              {used.length > 0 && (
                <ul className="cs-studio3d__legend">
                  {used.map((entry) => (
                    <li key={entry.id}>
                      <span style={{ background: entry.color }} aria-hidden="true" />
                      {entry.label}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Aspect des mailles"
              hint="Comment le tissu est dessiné"
              aside={
                viewport.stitches.drawn > 0 ? (
                  <StatusPill tone="ok" compact>
                    {`${viewport.stitches.drawn.toLocaleString('fr-FR')} mailles`}
                  </StatusPill>
                ) : undefined
              }
            >
              <Switch
                checked={three.showStitchDetail}
                label="Montrer les mailles"
                hint={
                  spec.stitchesAround > 0
                    ? `${spec.stitchesAround} mailles sur le tour, d’après votre échantillon`
                    : 'Aucun motif généré : les mailles ne peuvent pas être placées'
                }
                onCheckedChange={(showStitchDetail) => setThree({ showStitchDetail })}
              />

              {three.showStitchDetail && (
                <>
                  <div className="cs-studio3d__field">
                    <span className="cs-studio3d__field-label">Rendu</span>
                    <SegmentedControl
                      label="Rendu des mailles"
                      size="sm"
                      value={three.stitchRender}
                      segments={STITCH_RENDER_SEGMENTS}
                      onValueChange={(stitchRender) => setThree({ stitchRender })}
                    />
                  </div>

                  <p className="cs-studio3d__hint">
                    {three.stitchRender === 'geometry'
                      ? 'Chaque maille est un petit volume posé sur le tissu : on les voit en relief et chacune peut avoir sa couleur.'
                      : 'Le relief est peint sur une surface lisse : plus léger, mais les mailles ne sont pas de vrais volumes.'}
                  </p>

                  {three.stitchRender === 'geometry' && viewport.stitches.capped && (
                    <p className="cs-studio3d__notice">
                      {`Ce motif compte ${viewport.stitches.requested.toLocaleString('fr-FR')} mailles. ` +
                        `${viewport.stitches.drawn.toLocaleString('fr-FR')} sont dessinées, réparties sur toute la pièce, ` +
                        'pour que la vue reste fluide.'}
                    </p>
                  )}

                  <Slider
                    label={three.stitchRender === 'geometry' ? 'Taille des mailles' : 'Finesse du grain'}
                    value={three.stitchScale}
                    min={0.5}
                    max={2}
                    step={0.1}
                    display={`${three.stitchScale.toFixed(1).replace('.', ',')} ×`}
                    onValueChange={(stitchScale) => setThree({ stitchScale })}
                  />
                </>
              )}
            </Panel>

            <Panel title="Environnement" collapsible defaultOpen={false}>
              <div className="cs-studio3d__field">
                <span className="cs-studio3d__field-label">Fond</span>
                <SegmentedControl
                  label="Teinte du fond"
                  size="sm"
                  value={three.backgroundTone}
                  segments={BACKGROUND_SEGMENTS}
                  onValueChange={(backgroundTone) => setThree({ backgroundTone })}
                />
              </div>

              <Slider
                label="Lumière"
                value={three.lightIntensity}
                min={0.4}
                max={1.8}
                step={0.1}
                display={`${three.lightIntensity.toFixed(1).replace('.', ',')} ×`}
                onValueChange={(lightIntensity) => setThree({ lightIntensity })}
              />

              <Switch
                checked={three.showShadow}
                label="Ombre au sol"
                hint="Ombre de contact approchée, pas un calcul d’ombres portées"
                onCheckedChange={(showShadow) => setThree({ showShadow })}
              />

              <div className="cs-studio3d__field">
                <span className="cs-studio3d__field-label">Qualité d’affichage</span>
                <SegmentedControl
                  label="Qualité d’affichage"
                  size="sm"
                  value={three.quality}
                  segments={QUALITY_SEGMENTS}
                  onValueChange={(quality) => setThree({ quality })}
                />
              </div>
              <p className="cs-studio3d__hint">
                « Fluide » rend à la résolution de l’écran, « Détaillée » jusqu’au double — utile
                sur un écran très dense, plus exigeant pour la batterie.
              </p>
            </Panel>

            <Panel title="Modèle" hint="Ce que la géométrie contient réellement">
              <dl className="cs-studio3d__stats">
                {/* Measured off the built geometry, which is not always exactly
                    the measurement typed in: rounding to whole stitches moves it. */}
                <div>
                  <dt>Hauteur modèle</dt>
                  <dd>{formatLength(spec.totalHeightCm, units)}</dd>
                </div>
                <div>
                  <dt>Largeur modèle</dt>
                  <dd>{formatLength(spec.maxRadiusCm * 2, units)}</dd>
                </div>
                <div>
                  <dt>Mailles / tour</dt>
                  <dd>{spec.stitchesAround > 0 ? spec.stitchesAround : '—'}</dd>
                </div>
                <div>
                  <dt>Rangs</dt>
                  <dd>{spec.rowCount > 0 ? spec.rowCount : '—'}</dd>
                </div>
                <div>
                  <dt>Anneaux</dt>
                  <dd>{spec.rings.length}</dd>
                </div>
                <div>
                  <dt>Mailles dessinées</dt>
                  <dd>
                    {viewport.stitches.drawn > 0
                      ? viewport.stitches.drawn.toLocaleString('fr-FR')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Triangles</dt>
                  <dd>{viewport.triangleCount.toLocaleString('fr-FR')}</dd>
                </div>
              </dl>

              {spec.warnings.length > 0 && (
                <ul className="cs-studio3d__warnings">
                  {spec.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              <p className="cs-studio3d__hint">
                {spec.source === 'pattern'
                  ? 'Chaque anneau vient d’un tour du motif : rayon = mailles ÷ échantillon ÷ 2π.'
                  : 'Aucun motif : le volume est déduit directement des mesures.'}
              </p>
            </Panel>

            <Panel title="Aperçu du projet" hint="La vignette de votre bibliothèque">
              {project.thumbnail && (
                <img
                  src={project.thumbnail}
                  alt={`Aperçu capturé de ${project.name}`}
                  className="cs-studio3d__thumb"
                />
              )}

              <div className="cs-studio3d__actions">
                <Button
                  variant="primary"
                  icon="cube"
                  onClick={onCapture}
                  disabled={!viewport.supported}
                >
                  {project.thumbnail ? 'Remplacer l’aperçu' : 'Capturer l’aperçu'}
                </Button>
                {project.thumbnail && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      update({ thumbnail: null })
                      setCaptured(false)
                    }}
                  >
                    Retirer
                  </Button>
                )}
              </div>

              {captured && (
                <p className="cs-studio3d__captured" role="status">
                  Aperçu enregistré.
                </p>
              )}
            </Panel>
          </Surface>
        </aside>
      </div>
    </div>
  )
}
