import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategory } from '../../core/categories'
import { widthForStitches } from '../../core/gauge'
import { STITCHES } from '../../core/stitches'
import { formatLength, unitLabel } from '../../core/units'
import type { Project } from '../../core/types'
import {
  Button,
  EmptyState,
  Field,
  Icon,
  NumberInput,
  Panel,
  ProgressBar,
  SaveIndicator,
  StatusPill,
  Surface,
  Tabs,
  type TabItem,
} from '../../design/components'
import { useSettings } from '../../app/SettingsProvider'
import { DimensionFields } from '../projects/DimensionFields'
import { useProject } from '../projects/useProjects'
import { useProjectEditor } from '../projects/useProjectEditor'
import { PalettePanel } from '../studio/PalettePanel'
import { CalculationTable } from './CalculationTable'
import { GaugePanel } from './GaugePanel'
import { PatternSections } from './PatternSections'
import { SizePanel } from './SizePanel'
import { usePatternStudio } from './usePatternStudio'
import './PatternStudioPage.css'

type Step = 'gauge' | 'measurements' | 'size' | 'constraints' | 'generate' | 'calculations' | 'pattern'

export function PatternStudioPage() {
  const { settings } = useSettings()
  const stored = useProject(settings.activeProjectId)
  const { draft, status, lastSavedAt, update, saveNow } = useProjectEditor(stored ?? null)

  if (stored === undefined) {
    return <p className="cs-editor__loading">Ouverture du projet…</p>
  }

  if (stored === null || draft === null) {
    return (
      <EmptyState
        icon="pattern"
        title="Aucun projet ouvert"
        description="L’atelier travaille sur un projet à la fois. Ouvrez-en un depuis votre bibliothèque et il vous attendra ici."
        action={
          <Link to="/projects" className="cs-button cs-button--primary cs-button--md">
            <Icon name="projects" size={18} />
            <span>Voir mes projets</span>
          </Link>
        }
      />
    )
  }

  return (
    <EditorContent
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

function EditorContent({ project, status, lastSavedAt, update, saveNow }: ContentProps) {
  const { settings } = useSettings()
  const units = settings.units
  const studio = usePatternStudio(project, update)
  const [step, setStep] = useState<Step>('gauge')

  const category = getCategory(project.category)
  const missing = studio.plan.warnings.length
  const readyToGenerate = studio.plan.pattern.sections.length > 0

  const steps: TabItem<Step>[] = [
    { value: 'gauge', label: 'Échantillon' },
    { value: 'measurements', label: 'Mesures' },
    { value: 'size', label: 'Taille' },
    { value: 'constraints', label: 'Contraintes' },
    {
      value: 'generate',
      label: 'Génération',
      badge: missing > 0 ? String(missing) : undefined,
    },
    { value: 'calculations', label: 'Calculs', badge: String(studio.plan.derivations.length) },
    {
      value: 'pattern',
      label: 'Motif',
      badge: studio.stats.rows > 0 ? String(studio.stats.rows) : undefined,
    },
  ]

  return (
    <div className="cs-editor">
      {/* ---- Workspace header -------------------------------------------- */}
      <header className="cs-editor__header">
        <div>
          <p className="cs-editor__eyebrow">Atelier de motifs</p>
          <h1 className="cs-editor__title">{project.name}</h1>
          <div className="cs-editor__facts">
            <span>{category.label}</span>
            <span>
              Échantillon {project.gauge.stitchCount} m × {project.gauge.rowCount} r /{' '}
              {project.gauge.swatchWidthCm}×{project.gauge.swatchHeightCm} cm ·{' '}
              {STITCHES[project.gauge.stitch].abbreviation}
            </span>
            <span>Taille {project.sizing.activeSize}</span>
            {studio.isEmpty ? (
              <StatusPill tone="neutral">Motif non généré</StatusPill>
            ) : studio.isStale && studio.hasLockedRows ? (
              <StatusPill tone="warning">À recalculer</StatusPill>
            ) : (
              <StatusPill tone="ok">Motif à jour</StatusPill>
            )}
          </div>
        </div>

        <div className="cs-editor__header-actions">
          <SaveIndicator status={status} lastSavedAt={lastSavedAt} />
          <Link
            to={`/projects/${project.id}`}
            className="cs-button cs-button--secondary cs-button--md"
          >
            <Icon name="chevronLeft" size={18} />
            <span>Fiche projet</span>
          </Link>
          <Button onClick={() => void saveNow()} disabled={status === 'saving'}>
            Enregistrer
          </Button>
        </div>
      </header>

      <Tabs value={step} items={steps} label="Étapes du motif" variant="steps" onValueChange={setStep} />

      {/* ---- Always-visible summary -------------------------------------- */}
      <div className="cs-editor__summary">
        <div className="cs-editor__summary-stats">
          <span>
            <strong>{studio.stats.rows}</strong> rangs
          </span>
          <span>
            <strong>{studio.stats.stitches.toLocaleString('fr-FR')}</strong> mailles
          </span>
          <span>
            <strong>{Math.round(studio.stats.metres)}</strong> m de fil estimés
          </span>
          <span>
            <strong>{project.pattern.sections.length}</strong> sections
          </span>
        </div>

        {studio.isEmpty ? (
          <Button
            variant="primary"
            icon="pattern"
            onClick={() => {
              studio.apply()
              setStep('pattern')
            }}
            disabled={!readyToGenerate}
          >
            Générer le motif
          </Button>
        ) : studio.isStale && studio.hasLockedRows ? (
          <Button variant="primary" icon="refresh" onClick={studio.apply}>
            Recalculer
          </Button>
        ) : null}
      </div>

      {/* ---- Conflicts ---------------------------------------------------- */}
      {studio.conflicts.length > 0 && (
        <Surface padding="md" className="cs-editor__conflicts">
          <div className="cs-editor__conflicts-head">
            <h2>
              {studio.conflicts.length} point{studio.conflicts.length > 1 ? 's' : ''} à vérifier
            </h2>
            <Button size="sm" variant="ghost" onClick={studio.dismissConflicts}>
              J’ai vérifié
            </Button>
          </div>
          <ul>
            {studio.conflicts.map((conflict, index) => (
              <li key={`${conflict.kind}-${index}`}>{conflict.message}</li>
            ))}
          </ul>
        </Surface>
      )}

      {/* ---- Step content -------------------------------------------------- */}
      <div className="cs-editor__content">
        {step === 'gauge' && (
          <div className="cs-editor__columns">
            <GaugePanel project={project} units={units} update={update} />
            <Surface padding="lg">
              <h2 className="cs-editor__heading">Ce que l’échantillon donne</h2>
              <p className="cs-editor__lede">
                Vérification immédiate : voici la taille réelle que produisent les mailles calculées.
                Un écart avec la mesure demandée vient de l’arrondi à la maille entière.
              </p>
              <ul className="cs-editor__checks">
                {studio.plan.derivations
                  .filter((derivation) => derivation.label.includes('mailles'))
                  .slice(0, 4)
                  .map((derivation, index) => (
                    <li key={`${derivation.label}-${index}`}>
                      <span className="cs-editor__check-label">{derivation.label}</span>
                      <span className="cs-editor__check-value">
                        {derivation.finalResult} m ·{' '}
                        {formatLength(widthForStitches(derivation.finalResult, project.gauge), units)}
                      </span>
                    </li>
                  ))}
              </ul>
            </Surface>
          </div>
        )}

        {step === 'measurements' && (
          <Surface padding="lg">
            <h2 className="cs-editor__heading">
              Mesures du {category.label.toLowerCase()} fini
              <span className="cs-editor__unit">en {unitLabel(units)}</span>
            </h2>
            <p className="cs-editor__lede">
              Ce sont les dimensions de la pièce terminée, aisance comprise — pas les mesures du
              corps, qui se règlent à l’étape « Taille ». Toute modification relance les calculs.
            </p>
            <div className="cs-editor__fields">
              <DimensionFields
                category={project.category}
                dimensions={project.dimensions}
                units={units}
                onChange={(dimensions) => update({ dimensions })}
              />
            </div>
          </Surface>
        )}

        {step === 'size' && <SizePanel project={project} units={units} update={update} />}

        {step === 'constraints' && (
          <div className="cs-editor__columns">
            <Surface padding="lg">
              <h2 className="cs-editor__heading">Contraintes de construction</h2>
              <p className="cs-editor__lede">
                Ces règles s’appliquent à chaque nombre calculé. Chaque ajustement qu’elles
                provoquent est listé dans l’étape « Calculs ».
              </p>
              <div className="cs-editor__fields">
                <Field
                  label="Répétition du motif"
                  hint="Les mailles sont arrondies à un multiple de ce nombre. 1 = aucune contrainte."
                >
                  {({ id }) => (
                    <NumberInput
                      id={id}
                      value={project.pattern.repeat}
                      min={1}
                      onValueChange={(value) => value !== null && studio.setRepeat(value)}
                    />
                  )}
                </Field>

                <Field
                  label="Mailles de lisière"
                  hint="Ajoutées en dehors de la répétition, sur les pièces travaillées à plat."
                >
                  {({ id }) => (
                    <NumberInput
                      id={id}
                      value={project.pattern.edgeStitches}
                      min={0}
                      onValueChange={(value) => value !== null && studio.setEdgeStitches(value)}
                    />
                  )}
                </Field>

                <Field
                  label="Minimum de mailles"
                  hint="Plancher appliqué à chaque tour. 0 = seulement le minimum structurel."
                >
                  {({ id }) => (
                    <NumberInput
                      id={id}
                      value={project.pattern.minStitches}
                      min={0}
                      onValueChange={(value) => value !== null && studio.setMinStitches(value)}
                    />
                  )}
                </Field>

                <Field
                  label="Mailles par rang façonné"
                  hint="Augmentations ou diminutions posées sur un même rang. 2 convient à plat, 6 en rond."
                >
                  {({ id }) => (
                    <NumberInput
                      id={id}
                      value={project.pattern.shapingStep}
                      min={1}
                      onValueChange={(value) => value !== null && studio.setShapingStep(value)}
                    />
                  )}
                </Field>
              </div>
            </Surface>

            <Surface padding="lg">
              <h2 className="cs-editor__heading">Règles appliquées automatiquement</h2>
              <p className="cs-editor__lede">
                Elles ne se règlent pas : ce sont des contraintes de construction, pas des
                préférences.
              </p>
              <ul className="cs-editor__rules">
                <li>
                  <strong>Symétrie.</strong> Les pièces travaillées en rond et les panneaux
                  assemblés par paire sont arrondis à un nombre pair de mailles.
                </li>
                <li>
                  <strong>Arrondi.</strong> Au demi, vers le haut, au même endroit pour toute
                  l’application — jamais deux résultats différents pour le même nombre.
                </li>
                <li>
                  <strong>Minimum structurel.</strong> Un tour ne descend jamais sous une
                  répétition complète du motif.
                </li>
                <li>
                  <strong>Répartition du façonnage.</strong> Les augmentations sont espacées
                  régulièrement, et le nombre de rangs façonnés est indiqué dans les calculs.
                </li>
              </ul>
              <p className="cs-editor__note">
                Il n’y a pas de maximum de mailles : il déformerait la pièce sans le dire. Pour
                réduire une pièce, changez la mesure ou l’échantillon.
              </p>
            </Surface>
          </div>
        )}

        {step === 'generate' && (
          <div className="cs-editor__columns">
            <Surface padding="lg">
              <h2 className="cs-editor__heading">
                Génération
                {studio.isEmpty ? (
                  <StatusPill tone="neutral">aucun motif</StatusPill>
                ) : studio.isStale ? (
                  <StatusPill tone="warning">décalé</StatusPill>
                ) : (
                  <StatusPill tone="ok">à jour</StatusPill>
                )}
              </h2>
              <p className="cs-editor__lede">
                L’atelier construit les sections, les mailles et les rangs à partir de vos mesures
                et de votre échantillon. Vous pourrez ensuite tout modifier à la main.
              </p>

              <ul className="cs-editor__sections-preview">
                {studio.plan.pattern.sections.map((section) => (
                  <li key={section.id}>
                    <span>{section.name}</span>
                    <span className="cs-editor__numeric">
                      {section.rows.length} rangs · {section.rows[0]?.stitchCount ?? 0} →{' '}
                      {section.rows.at(-1)?.stitchCount ?? 0} m
                    </span>
                  </li>
                ))}
                {studio.plan.pattern.sections.length === 0 && (
                  <li className="cs-editor__sections-empty">
                    Rien ne peut être généré : il manque des mesures.
                  </li>
                )}
              </ul>

              <div className="cs-editor__actions">
                <Button
                  variant="primary"
                  icon={studio.isEmpty ? 'pattern' : 'refresh'}
                  onClick={() => {
                    studio.apply()
                    setStep('pattern')
                  }}
                  disabled={!readyToGenerate}
                >
                  {studio.isEmpty ? 'Générer le motif' : 'Régénérer en gardant mes rangs'}
                </Button>
                {!studio.isEmpty && (
                  <Button variant="ghost" icon="trash" onClick={studio.clearPattern}>
                    Vider le motif
                  </Button>
                )}
              </div>
            </Surface>

            <Surface padding="lg">
              <h2 className="cs-editor__heading">
                Vérifications
                {studio.plan.warnings.length === 0 ? (
                  <StatusPill tone="ok">rien à signaler</StatusPill>
                ) : (
                  <StatusPill tone="warning">{`${studio.plan.warnings.length} à vérifier`}</StatusPill>
                )}
              </h2>
              {studio.plan.warnings.length === 0 ? (
                <p className="cs-editor__lede">
                  Toutes les mesures nécessaires sont renseignées et le façonnage tient dans les
                  rangs disponibles.
                </p>
              ) : (
                <ul className="cs-editor__warnings">
                  {studio.plan.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              {studio.hasLockedRows && (
                <p className="cs-editor__note">
                  Des rangs sont fixés à la main : une régénération les conservera et signalera
                  ceux qui ne concordent plus avec les nouveaux calculs.
                </p>
              )}
            </Surface>
          </div>
        )}

        {step === 'calculations' && (
          <Surface padding="lg">
            <h2 className="cs-editor__heading">Calculs</h2>
            <p className="cs-editor__lede">
              Chaque nombre vient de votre échantillon. Ouvrez une ligne pour voir la formule, les
              valeurs utilisées et chaque ajustement avec sa raison.
            </p>
            <div className="cs-editor__calc">
              <CalculationTable derivations={studio.plan.derivations} />
            </div>
          </Surface>
        )}

        {step === 'pattern' && (
          <div className="cs-editor__pattern">
            <Surface padding="lg">
              <div className="cs-editor__pattern-head">
                <div>
                  <h2 className="cs-editor__heading">Avancement</h2>
                  <p className="cs-editor__lede">
                    Cochez un rang pour marquer que vous avez crocheté jusque-là.
                  </p>
                </div>
                <div className="cs-editor__progress-field">
                  <Field label="Rangs crochetés">
                    {({ id }) => (
                      <NumberInput
                        id={id}
                        value={project.progress.completedRows}
                        min={0}
                        max={project.progress.totalRows}
                        onValueChange={(value) => value !== null && studio.setCompletedRows(value)}
                      />
                    )}
                  </Field>
                </div>
              </div>
              <ProgressBar
                completed={project.progress.completedRows}
                total={project.progress.totalRows}
              />
            </Surface>

            <div className="cs-editor__pattern-body">
              <div className="cs-editor__pattern-main">
                <div className="cs-editor__pattern-actions">
                  <p className="cs-editor__legend">
                    <span>
                      <strong>Cadenas ouvert</strong> : rang calculé, il suit vos mesures.
                    </span>
                    <span>
                      <strong>Cadenas fermé</strong> : rang fixé par vous, le recalcul le respecte.
                    </span>
                  </p>
                  <Button
                    size="sm"
                    icon="plus"
                    onClick={() => studio.addSection('Nouvelle section', 'flat')}
                  >
                    Ajouter une section
                  </Button>
                </div>

                {studio.isEmpty ? (
                  <EmptyState
                    icon="pattern"
                    title="Aucun rang pour l’instant"
                    description="Générez le motif depuis vos mesures, puis ajustez-le rang par rang."
                    action={
                      <Button
                        variant="primary"
                        icon="pattern"
                        onClick={studio.apply}
                        disabled={!readyToGenerate}
                      >
                        Générer le motif
                      </Button>
                    }
                  />
                ) : (
                  <PatternSections
                    pattern={project.pattern}
                    yarn={project.yarn}
                    completedRows={project.progress.completedRows}
                    studio={studio}
                  />
                )}
              </div>

              <aside className="cs-editor__pattern-aside">
                <Surface padding="none">
                  <Panel title="Couleurs" hint="Palette du projet">
                    <PalettePanel project={project} update={update} />
                    <p className="cs-editor__note">
                      Posez les couleurs rang par rang ici, ou par sections et rayures dans
                      l’atelier 3D.
                    </p>
                  </Panel>
                </Surface>
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
