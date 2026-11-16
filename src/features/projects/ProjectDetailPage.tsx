import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { categoryList, getCategory } from '../../core/categories'
import { formatDateTime, formatRelative } from '../../core/dates'
import { HOOK_SIZES_MM, STITCH_ORDER, STITCHES, YARN_WEIGHTS, YARN_WEIGHT_ORDER, isHookInRange } from '../../core/stitches'
import { fromCm, toCm, unitLabel } from '../../core/units'
import type { ProjectCategory, StitchId, YarnWeight } from '../../core/types'
import {
  Button,
  ColorInput,
  ConfirmDialog,
  Field,
  Icon,
  NumberInput,
  ProgressBar,
  SaveIndicator,
  Select,
  Surface,
  Tag,
  TextArea,
  TextInput,
} from '../../design/components'
import { useSettings } from '../../app/SettingsProvider'
import { setActiveProject } from '../../data/repositories/projectRepository'
import { DimensionFields } from './DimensionFields'
import { ProjectPreview } from './ProjectPreview'
import { useProject } from './useProjects'
import { useProjectActions } from './useProjectActions'
import { useProjectEditor } from './useProjectEditor'
import './ProjectDetailPage.css'

const YARN_PRESETS = ['#D9B6B0', '#E5D5C3', '#8B7464', '#44382F', '#A3A98F', '#F1E8DC'] as const

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { settings } = useSettings()
  const units = settings.units
  const navigate = useNavigate()

  const stored = useProject(projectId ?? null)
  const { draft, status, lastSavedAt, update, saveNow } = useProjectEditor(stored ?? null)
  const actions = useProjectActions()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (stored === undefined) {
    return <p className="cs-detail__loading">Ouverture du projet…</p>
  }

  if (stored === null || draft === null) {
    return (
      <div className="cs-detail__missing">
        <h1>Ce projet est introuvable</h1>
        <p>Il a peut-être été supprimé sur cet appareil, ou le lien n’est plus à jour.</p>
        <Button icon="chevronLeft" onClick={() => navigate('/projects')}>
          Retour à mes projets
        </Button>
      </div>
    )
  }

  const category = getCategory(draft.category)
  const gauge = draft.gauge
  const yarn = draft.yarn

  const openInPatternStudio = async () => {
    await saveNow()
    await setActiveProject(draft.id)
    navigate('/pattern')
  }

  const duplicate = async () => {
    await saveNow()
    const copy = await actions.duplicate(draft.id)
    if (copy) navigate(`/projects/${copy.id}`)
  }

  const remove = async () => {
    const deleted = await actions.remove(draft.id)
    if (deleted) navigate('/projects')
  }

  return (
    <>
      <nav className="cs-detail__breadcrumb">
        <Link to="/projects">
          <Icon name="chevronLeft" size={16} />
          Mes projets
        </Link>
      </nav>

      <header className="cs-detail__header">
        <div className="cs-detail__title-block">
          <h1 className="cs-detail__title">{draft.name}</h1>
          <div className="cs-detail__badges">
            <Tag colorVar={category.colorVar}>{category.label}</Tag>
            <span className="cs-detail__timestamp">Modifié {formatRelative(draft.updatedAt)}</span>
            <SaveIndicator status={status} lastSavedAt={lastSavedAt} />
          </div>
        </div>

        <div className="cs-detail__actions">
          <Button icon="trash" iconOnly variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Supprimer le projet
          </Button>
          <Button icon="copy" onClick={() => void duplicate()} disabled={actions.busy}>
            Dupliquer
          </Button>
          <Button variant="primary" icon="pattern" onClick={() => void openInPatternStudio()}>
            Ouvrir dans l’atelier
          </Button>
        </div>
      </header>

      {actions.error && (
        <p className="cs-detail__error" role="alert">
          {actions.error}
        </p>
      )}

      <div className="cs-detail__layout">
        <div className="cs-detail__aside">
          <Surface padding="sm">
            <ProjectPreview project={draft} size="large" />
            <div className="cs-detail__aside-body">
              <ProgressBar
                completed={draft.progress.completedRows}
                total={draft.progress.totalRows}
              />
              <dl className="cs-detail__facts">
                <div>
                  <dt>Créé le</dt>
                  <dd>{formatDateTime(draft.createdAt)}</dd>
                </div>
                <div>
                  <dt>Dernier enregistrement</dt>
                  <dd>{formatDateTime(draft.updatedAt)}</dd>
                </div>
              </dl>
              <p className="cs-detail__aside-note">
                La silhouette est dessinée à partir de la catégorie, des mesures et de la couleur de
                fil de ce projet. La phase 4 la remplacera par une capture du modèle 3D.
              </p>
            </div>
          </Surface>

          <Button onClick={() => void saveNow()} disabled={status === 'saving'}>
            Enregistrer maintenant
          </Button>
        </div>

        <div className="cs-detail__main">
          <Surface padding="lg">
            <h2 className="cs-detail__heading">Projet</h2>
            <div className="cs-detail__grid">
              <Field label="Nom">
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={draft.name}
                    maxLength={80}
                    onValueChange={(value) => update({ name: value })}
                  />
                )}
              </Field>
              <Field
                label="Catégorie"
                hint="Changer de catégorie change les mesures demandées ; celles qui ne s’appliquent plus sont retirées."
              >
                {({ id }) => (
                  <Select<ProjectCategory>
                    id={id}
                    value={draft.category}
                    options={categoryList().map((definition) => ({
                      value: definition.id,
                      label: definition.label,
                    }))}
                    onValueChange={(value) => update({ category: value })}
                  />
                )}
              </Field>
            </div>
          </Surface>

          <Surface padding="lg">
            <h2 className="cs-detail__heading">
              Mesures finies
              <span className="cs-detail__unit">en {unitLabel(units)}</span>
            </h2>
            <div className="cs-detail__grid">
              <DimensionFields
                category={draft.category}
                dimensions={draft.dimensions}
                units={units}
                onChange={(dimensions) => update({ dimensions })}
              />
            </div>
          </Surface>

          <Surface padding="lg">
            <h2 className="cs-detail__heading">Échantillon</h2>
            <p className="cs-detail__lede">
              Crochetez un carré avec votre fil et votre crochet, puis comptez ce que vous obtenez.
              Toutes les mailles et tous les rangs de l’atelier découlent de ces quatre nombres.
            </p>
            <div className="cs-detail__grid">
              <Field label="Mailles comptées">
                {({ id }) => (
                  <NumberInput
                    id={id}
                    value={gauge.stitchCount}
                    min={1}
                    onValueChange={(value) =>
                      value !== null && update({ gauge: { ...gauge, stitchCount: value } })
                    }
                  />
                )}
              </Field>
              <Field label="Rangs comptés">
                {({ id }) => (
                  <NumberInput
                    id={id}
                    value={gauge.rowCount}
                    min={1}
                    onValueChange={(value) =>
                      value !== null && update({ gauge: { ...gauge, rowCount: value } })
                    }
                  />
                )}
              </Field>
              <Field label="Largeur de l’échantillon" suffix={unitLabel(units)}>
                {({ id }) => (
                  <NumberInput
                    id={id}
                    value={round1(fromCm(gauge.swatchWidthCm, units))}
                    min={1}
                    onValueChange={(value) =>
                      value !== null &&
                      update({ gauge: { ...gauge, swatchWidthCm: toCm(value, units) } })
                    }
                  />
                )}
              </Field>
              <Field label="Hauteur de l’échantillon" suffix={unitLabel(units)}>
                {({ id }) => (
                  <NumberInput
                    id={id}
                    value={round1(fromCm(gauge.swatchHeightCm, units))}
                    min={1}
                    onValueChange={(value) =>
                      value !== null &&
                      update({ gauge: { ...gauge, swatchHeightCm: toCm(value, units) } })
                    }
                  />
                )}
              </Field>
              <Field label="Maille utilisée" hint={STITCHES[gauge.stitch].description}>
                {({ id }) => (
                  <Select<StitchId>
                    id={id}
                    value={gauge.stitch}
                    options={STITCH_ORDER.map((stitchId) => ({
                      value: stitchId,
                      label: `${STITCHES[stitchId].name} (${STITCHES[stitchId].abbreviation})`,
                    }))}
                    onValueChange={(value) => update({ gauge: { ...gauge, stitch: value } })}
                  />
                )}
              </Field>
              <Field
                label="Crochet"
                hint={
                  isHookInRange(gauge.hookSizeMm, yarn.weight)
                    ? `Dans la plage conseillée pour un fil ${YARN_WEIGHTS[yarn.weight].label}`
                    : `Hors de la plage ${YARN_WEIGHTS[yarn.weight].hookRangeMm[0]}–${YARN_WEIGHTS[yarn.weight].hookRangeMm[1]} mm conseillée pour un fil ${YARN_WEIGHTS[yarn.weight].label} — sans problème si c’est voulu`
                }
              >
                {({ id }) => (
                  <Select<string>
                    id={id}
                    value={String(gauge.hookSizeMm)}
                    options={HOOK_SIZES_MM.map((size) => ({
                      value: String(size),
                      label: `${size} mm`,
                    }))}
                    onValueChange={(value) =>
                      update({ gauge: { ...gauge, hookSizeMm: Number.parseFloat(value) } })
                    }
                  />
                )}
              </Field>
            </div>
          </Surface>

          <Surface padding="lg">
            <h2 className="cs-detail__heading">Fil</h2>
            <div className="cs-detail__grid">
              <Field label="Nom du fil">
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={yarn.name}
                    onValueChange={(value) => update({ yarn: { ...yarn, name: value } })}
                  />
                )}
              </Field>
              <Field label="Matière">
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={yarn.fibre}
                    placeholder="Coton, laine, lin…"
                    onValueChange={(value) => update({ yarn: { ...yarn, fibre: value } })}
                  />
                )}
              </Field>
              <Field
                label="Grosseur"
                hint="Définit aussi l’épaisseur du brin utilisée par le modèle 3D"
              >
                {({ id }) => (
                  <Select<YarnWeight>
                    id={id}
                    value={yarn.weight}
                    options={YARN_WEIGHT_ORDER.map((weight) => ({
                      value: weight,
                      label: YARN_WEIGHTS[weight].label,
                    }))}
                    onValueChange={(value) =>
                      update({
                        yarn: {
                          ...yarn,
                          weight: value,
                          strandDiameterMm: YARN_WEIGHTS[value].strandDiameterMm,
                        },
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Mètres pour 100 g" hint="Indiqué sur l’étiquette ; laissez vide si inconnu">
                {({ id }) => (
                  <NumberInput
                    id={id}
                    value={yarn.metresPer100g}
                    min={0}
                    allowEmpty
                    onValueChange={(value) => update({ yarn: { ...yarn, metresPer100g: value } })}
                  />
                )}
              </Field>
              <Field label="Couleur">
                {({ id }) => (
                  <ColorInput
                    id={id}
                    value={yarn.color}
                    presets={YARN_PRESETS}
                    onValueChange={(value) => update({ yarn: { ...yarn, color: value } })}
                  />
                )}
              </Field>
            </div>
          </Surface>

          <Surface padding="lg">
            <h2 className="cs-detail__heading">Notes</h2>
            <Field label="Tout ce qui mérite d’être noté">
              {({ id }) => (
                <TextArea
                  id={id}
                  value={draft.notes}
                  rows={5}
                  placeholder="Fil de substitution, ajustements, le rang où vous vous êtes arrêtée…"
                  onValueChange={(value) => update({ notes: value })}
                />
              )}
            </Field>
          </Surface>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Supprimer ce projet ?"
        description={`« ${draft.name} » et son motif seront effacés de cet appareil. C’est irréversible, sauf si vous avez une sauvegarde.`}
        confirmLabel="Supprimer le projet"
        destructive
        busy={actions.busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  )
}

const round1 = (value: number) => Math.round(value * 10) / 10
