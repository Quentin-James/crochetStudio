import { useLiveQuery } from 'dexie-react-hooks'
import {
  MEASUREMENT_LABELS,
  MEASUREMENT_ORDER,
  SIZE_TABLE,
  STANDARD_SIZES,
  compareSizes,
  deriveDimensions,
  effectiveMeasurements,
  hasOverrides,
} from '../../core/sizing'
import { formatLength, fromCm, toCm, unitLabel } from '../../core/units'
import type {
  MeasurementKey,
  Project,
  SizingState,
  StandardSize,
  UnitSystem,
} from '../../core/types'
import {
  Button,
  Field,
  NumberInput,
  SegmentedControl,
  Surface,
  Tag,
  TextInput,
  type Segment,
} from '../../design/components'
import {
  createSizeProfile,
  deleteSizeProfile,
  listSizeProfiles,
  updateSizeProfile,
} from '../../data/repositories/sizeProfileRepository'
import type { ProjectPatch } from '../../data/repositories/projectRepository'

interface SizePanelProps {
  project: Project
  units: UnitSystem
  update: (patch: ProjectPatch) => void
}

type SizeChoice = StandardSize | 'custom'

const SIZE_SEGMENTS: Segment<SizeChoice>[] = [
  ...STANDARD_SIZES.map((size) => ({ value: size as SizeChoice, label: size })),
  { value: 'custom', label: 'Sur mesure' },
]

/**
 * Size selection, measurement overrides and custom profiles.
 *
 * Changing the size never rewrites the project's dimensions on its own: the
 * measurements are shown, and the user chooses to apply them. Sizes are body
 * measurements, dimensions are the finished garment — the ease between them is
 * a decision, not a conversion.
 */
export function SizePanel({ project, units, update }: SizePanelProps) {
  const sizing = project.sizing
  const profiles = useLiveQuery(() => listSizeProfiles(), [], undefined)
  const activeProfile = profiles?.find((profile) => profile.id === sizing.customProfileId) ?? null

  const measurements = effectiveMeasurements(sizing, activeProfile?.measurements)
  const isCustom = sizing.activeSize === 'custom'
  const appliesToDimensions = project.category === 'dress'

  const setSizing = (patch: Partial<SizingState>) => update({ sizing: { ...sizing, ...patch } })

  const chooseSize = async (choice: SizeChoice) => {
    if (choice !== 'custom') {
      setSizing({ activeSize: choice })
      return
    }

    // Seed the first profile from the size that was showing, so the user starts
    // from plausible numbers rather than an empty form.
    if (!activeProfile) {
      const existing = profiles?.[0]
      if (existing) {
        setSizing({ activeSize: 'custom', customProfileId: existing.id })
        return
      }
      const seed =
        sizing.activeSize === 'custom' ? SIZE_TABLE.M : SIZE_TABLE[sizing.activeSize]
      const created = await createSizeProfile(
        'Mes mesures',
        { ...seed },
        sizing.activeSize === 'custom' ? null : sizing.activeSize,
      )
      setSizing({ activeSize: 'custom', customProfileId: created.id })
      return
    }

    setSizing({ activeSize: 'custom' })
  }

  const setMeasurement = async (key: MeasurementKey, value: number | null) => {
    if (isCustom && activeProfile) {
      const next = { ...activeProfile.measurements }
      if (value === null) delete next[key]
      else next[key] = value
      await updateSizeProfile(activeProfile.id, { measurements: next })
      return
    }

    if (sizing.activeSize === 'custom') return

    const size = sizing.activeSize
    const current = { ...(sizing.overrides[size] ?? {}) }
    if (value === null) delete current[key]
    else current[key] = value

    setSizing({ overrides: { ...sizing.overrides, [size]: current } })
  }

  const resetOverrides = () => {
    if (sizing.activeSize === 'custom') return
    const next = { ...sizing.overrides }
    delete next[sizing.activeSize]
    setSizing({ overrides: next })
  }

  const applyToDimensions = () => {
    update({
      dimensions: deriveDimensions(
        project.category,
        measurements,
        sizing.easeCm,
        project.dimensions,
      ),
    })
  }

  const comparison = compareSizes(sizing)

  return (
    <Surface padding="lg">
      <h2 className="cs-studio__heading">
        Taille
        {sizing.activeSize !== 'custom' && hasOverrides(sizing, sizing.activeSize) && (
          <Tag tone="accent">modifiée</Tag>
        )}
      </h2>
      <p className="cs-studio__lede">
        Les tailles sont des mesures corporelles. L’aisance est ajoutée au tour de poitrine et aux
        hanches pour obtenir les dimensions du vêtement fini.
      </p>

      <div className="cs-studio__sizes">
        <SegmentedControl
          label="Taille active"
          size="sm"
          value={sizing.activeSize}
          segments={SIZE_SEGMENTS}
          onValueChange={(value) => void chooseSize(value)}
        />
      </div>

      {isCustom && activeProfile && (
        <div className="cs-studio__grid cs-studio__grid--profile">
          <Field label="Nom du profil">
            {({ id }) => (
              <TextInput
                id={id}
                value={activeProfile.name}
                onValueChange={(value) => void updateSizeProfile(activeProfile.id, { name: value })}
              />
            )}
          </Field>
          <div className="cs-studio__profile-actions">
            <Button
              size="sm"
              icon="plus"
              onClick={() => {
                void createSizeProfile('Nouveau profil', { ...SIZE_TABLE.M }).then((created) =>
                  setSizing({ customProfileId: created.id }),
                )
              }}
            >
              Nouveau profil
            </Button>
            {profiles && profiles.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                icon="trash"
                onClick={() => {
                  const fallback = profiles.find((profile) => profile.id !== activeProfile.id)
                  void deleteSizeProfile(activeProfile.id).then(() =>
                    setSizing({ customProfileId: fallback?.id ?? null }),
                  )
                }}
              >
                Supprimer
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="cs-studio__grid">
        {MEASUREMENT_ORDER.map((key) => {
          const value = measurements[key]
          return (
            <Field key={key} label={MEASUREMENT_LABELS[key]} suffix={unitLabel(units)}>
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={value === undefined ? null : round1(fromCm(value, units))}
                  allowEmpty
                  min={0}
                  onValueChange={(next) =>
                    void setMeasurement(key, next === null ? null : toCm(next, units))
                  }
                />
              )}
            </Field>
          )
        })}

        <Field
          label="Aisance"
          suffix={unitLabel(units)}
          hint="Ajoutée aux circonférences. Négative pour un vêtement près du corps."
        >
          {({ id }) => (
            <NumberInput
              id={id}
              value={round1(fromCm(sizing.easeCm, units))}
              onValueChange={(value) => value !== null && setSizing({ easeCm: toCm(value, units) })}
            />
          )}
        </Field>
      </div>

      <div className="cs-studio__actions">
        {appliesToDimensions ? (
          <Button variant="primary" icon="ruler" onClick={applyToDimensions}>
            Appliquer aux mesures du projet
          </Button>
        ) : (
          <p className="cs-studio__note">
            Les tailles corporelles ne s’appliquent qu’aux vêtements : les dimensions d’un sac ou
            d’un accessoire se règlent directement dans « Mesures du projet ».
          </p>
        )}
        {sizing.activeSize !== 'custom' && hasOverrides(sizing, sizing.activeSize) && (
          <Button variant="ghost" onClick={resetOverrides}>
            Revenir à la taille standard
          </Button>
        )}
      </div>

      <details className="cs-studio__comparison">
        <summary>Comparer toutes les tailles</summary>
        <div className="cs-studio__table-wrap">
          <table className="cs-studio__table">
            <thead>
              <tr>
                <th scope="col">Mesure</th>
                {STANDARD_SIZES.map((size) => (
                  <th key={size} scope="col" className={size === sizing.activeSize ? 'is-active' : ''}>
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {STANDARD_SIZES.map((size) => (
                    <td key={size} className={size === sizing.activeSize ? 'is-active' : ''}>
                      {row.values[size] === undefined
                        ? '—'
                        : formatLength(row.values[size] as number, units, false)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Surface>
  )
}

const round1 = (value: number) => Math.round(value * 10) / 10
