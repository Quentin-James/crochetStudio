import { useCallback, useEffect, useState } from 'react'
import { formatBytes, fromCm, toCm, unitLabel } from '../../core/units'
import { HOOK_SIZES_MM, STITCHES, STITCH_ORDER, YARN_WEIGHTS, YARN_WEIGHT_ORDER } from '../../core/stitches'
import type { StandardSize, StitchId, UnitSystem, YarnWeight } from '../../core/types'
import { getStorageReport, requestPersistentStorage } from '../../data/db'
import { eraseAllData } from '../../data/backup/backup'
import {
  Button,
  ColorInput,
  ConfirmDialog,
  Field,
  NumberInput,
  PageHeader,
  SegmentedControl,
  Select,
  Surface,
  type Segment,
} from '../../design/components'
import { useSettings } from '../../app/SettingsProvider'
import { BackupPanel } from './BackupPanel'
import './SettingsPage.css'

const UNIT_SEGMENTS: Segment<UnitSystem>[] = [
  { value: 'metric', label: 'Centimètres' },
  { value: 'imperial', label: 'Pouces' },
]

const SIZES: StandardSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const YARN_PRESETS = ['#D9B6B0', '#E5D5C3', '#8B7464', '#44382F', '#A3A98F', '#F1E8DC'] as const

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const units = settings.units

  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<number | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [confirmErase, setConfirmErase] = useState(false)
  const [erasing, setErasing] = useState(false)

  const refresh = useCallback(async () => {
    const report = await getStorageReport()
    setPersisted(report.persisted)
    setUsage(report.usageBytes)
    setUnsupported(report.persisted === null)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onRequestPersistence = async () => {
    setRequesting(true)
    try {
      const granted = await requestPersistentStorage()
      setPersisted(granted)
      if (granted === null) setUnsupported(true)
    } finally {
      setRequesting(false)
    }
  }

  const onErase = async () => {
    setErasing(true)
    try {
      await eraseAllData()
      setConfirmErase(false)
      await refresh()
    } finally {
      setErasing(false)
    }
  }

  const gauge = settings.defaultGauge
  const yarn = settings.defaultYarn

  return (
    <>
      <PageHeader
        eyebrow="Préférences"
        title="Réglages"
        lede="Les unités, les valeurs par défaut des nouveaux projets, et la façon dont votre travail est stocké sur cet appareil."
      />

      <div className="cs-settings">
        <Surface padding="lg">
          <h2 className="cs-settings__heading">Unités</h2>
          <p className="cs-settings__body">
            Les mesures sont toujours enregistrées en centimètres et converties pour l’affichage :
            passer de l’une à l’autre ne modifie jamais vos dimensions.
          </p>
          <div className="cs-settings__actions">
            <SegmentedControl
              label="Unité de mesure"
              value={units}
              segments={UNIT_SEGMENTS}
              onValueChange={(value) => void updateSettings({ units: value })}
            />
          </div>
        </Surface>

        <Surface padding="lg">
          <h2 className="cs-settings__heading">Valeurs par défaut des nouveaux projets</h2>
          <p className="cs-settings__body">
            Votre fil et votre échantillon habituels. Chaque projet en garde sa propre copie :
            modifier ces valeurs ne touche jamais à un projet déjà créé.
          </p>

          <div className="cs-settings__grid">
            <Field label="Taille par défaut">
              {({ id }) => (
                <Select<StandardSize>
                  id={id}
                  value={settings.defaultSize}
                  options={SIZES.map((size) => ({ value: size, label: size }))}
                  onValueChange={(value) => void updateSettings({ defaultSize: value })}
                />
              )}
            </Field>

            <Field
              label="Délai d’enregistrement"
              suffix="ms"
              hint="Temps d’attente après la dernière frappe"
            >
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={settings.autosaveDelayMs}
                  min={100}
                  max={5000}
                  onValueChange={(value) =>
                    value !== null &&
                    void updateSettings({
                      autosaveDelayMs: Math.min(5000, Math.max(100, Math.round(value))),
                    })
                  }
                />
              )}
            </Field>

            <Field label="Mailles de l’échantillon">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={gauge.stitchCount}
                  min={1}
                  onValueChange={(value) =>
                    value !== null &&
                    void updateSettings({ defaultGauge: { ...gauge, stitchCount: value } })
                  }
                />
              )}
            </Field>

            <Field label="Rangs de l’échantillon">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={gauge.rowCount}
                  min={1}
                  onValueChange={(value) =>
                    value !== null &&
                    void updateSettings({ defaultGauge: { ...gauge, rowCount: value } })
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
                    void updateSettings({
                      defaultGauge: { ...gauge, swatchWidthCm: toCm(value, units) },
                    })
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
                    void updateSettings({
                      defaultGauge: { ...gauge, swatchHeightCm: toCm(value, units) },
                    })
                  }
                />
              )}
            </Field>

            <Field label="Maille par défaut" hint={STITCHES[gauge.stitch].description}>
              {({ id }) => (
                <Select<StitchId>
                  id={id}
                  value={gauge.stitch}
                  options={STITCH_ORDER.map((stitchId) => ({
                    value: stitchId,
                    label: `${STITCHES[stitchId].name} (${STITCHES[stitchId].abbreviation})`,
                  }))}
                  onValueChange={(value) =>
                    void updateSettings({ defaultGauge: { ...gauge, stitch: value } })
                  }
                />
              )}
            </Field>

            <Field label="Crochet par défaut">
              {({ id }) => (
                <Select<string>
                  id={id}
                  value={String(gauge.hookSizeMm)}
                  options={HOOK_SIZES_MM.map((size) => ({
                    value: String(size),
                    label: `${size} mm`,
                  }))}
                  onValueChange={(value) =>
                    void updateSettings({
                      defaultGauge: { ...gauge, hookSizeMm: Number.parseFloat(value) },
                    })
                  }
                />
              )}
            </Field>

            <Field label="Grosseur de fil par défaut">
              {({ id }) => (
                <Select<YarnWeight>
                  id={id}
                  value={yarn.weight}
                  options={YARN_WEIGHT_ORDER.map((weight) => ({
                    value: weight,
                    label: YARN_WEIGHTS[weight].label,
                  }))}
                  onValueChange={(value) =>
                    void updateSettings({
                      defaultYarn: {
                        ...yarn,
                        weight: value,
                        strandDiameterMm: YARN_WEIGHTS[value].strandDiameterMm,
                      },
                    })
                  }
                />
              )}
            </Field>

            <Field label="Couleur de fil par défaut">
              {({ id }) => (
                <ColorInput
                  id={id}
                  value={yarn.color}
                  presets={YARN_PRESETS}
                  onValueChange={(value) =>
                    void updateSettings({ defaultYarn: { ...yarn, color: value } })
                  }
                />
              )}
            </Field>
          </div>
        </Surface>

        <BackupPanel />

        <Surface padding="lg">
          <h2 className="cs-settings__heading">Stockage local</h2>
          <p className="cs-settings__body">
            Crochet Studio garde tout dans le stockage de ce navigateur — sans compte et sans
            serveur. Les navigateurs peuvent vider le stockage des sites non ouverts depuis
            longtemps ; demander la persistance en exempte vos projets. Sur iPad, ajoutez aussi
            l’application à l’écran d’accueil : c’est ce qui rend l’exemption durable.
          </p>

          <dl className="cs-settings__facts">
            <div>
              <dt>Protection contre l’effacement</dt>
              <dd>
                {unsupported
                  ? 'Non prise en charge par ce navigateur'
                  : persisted === true
                    ? 'Accordée'
                    : 'Non accordée'}
              </dd>
            </div>
            <div>
              <dt>Espace utilisé</dt>
              <dd>{usage === null ? 'Non communiqué' : formatBytes(usage)}</dd>
            </div>
          </dl>

          <div className="cs-settings__actions">
            <Button
              variant="primary"
              onClick={() => void onRequestPersistence()}
              disabled={requesting || unsupported || persisted === true}
            >
              {persisted === true ? 'Protection déjà accordée' : 'Demander la protection'}
            </Button>
            <Button variant="ghost" onClick={() => void refresh()}>
              Vérifier à nouveau
            </Button>
          </div>
        </Surface>

        <Surface padding="lg" className="cs-settings__danger">
          <h2 className="cs-settings__heading">Effacer les données locales</h2>
          <p className="cs-settings__body">
            Supprime tous les projets, profils de taille et préférences de cet appareil. Exportez
            d’abord une sauvegarde si vous souhaitez garder quelque chose — c’est irréversible.
          </p>
          <div className="cs-settings__actions">
            <Button
              variant="primary"
              className="cs-button--destructive"
              icon="trash"
              onClick={() => setConfirmErase(true)}
            >
              Tout effacer
            </Button>
          </div>
        </Surface>
      </div>

      <ConfirmDialog
        open={confirmErase}
        title="Effacer toutes les données locales ?"
        description="Tous les projets, profils de taille et préférences enregistrés dans ce navigateur seront supprimés. Sans sauvegarde exportée, ce travail sera irrécupérable."
        confirmLabel="Tout effacer"
        destructive
        busy={erasing}
        onConfirm={() => void onErase()}
        onCancel={() => setConfirmErase(false)}
      />
    </>
  )
}

const round1 = (value: number) => Math.round(value * 10) / 10
