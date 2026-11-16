import { rowsPerCm, stitchesPerCm } from '../../core/gauge'
import { HOOK_SIZES_MM, STITCHES, STITCH_ORDER, isHookInRange, YARN_WEIGHTS } from '../../core/stitches'
import { fromCm, toCm, unitLabel } from '../../core/units'
import type { Gauge, Project, StitchId, UnitSystem } from '../../core/types'
import { Field, NumberInput, Select, Surface } from '../../design/components'
import type { ProjectPatch } from '../../data/repositories/projectRepository'

interface GaugePanelProps {
  project: Project
  units: UnitSystem
  update: (patch: ProjectPatch) => void
}

/** The swatch panel: the four numbers every other figure in the studio comes from. */
export function GaugePanel({ project, units, update }: GaugePanelProps) {
  const gauge = project.gauge
  const setGauge = (patch: Partial<Gauge>) => update({ gauge: { ...gauge, ...patch } })

  const density = safeDensity(gauge)

  return (
    <Surface padding="lg">
      <h2 className="cs-studio__heading">Échantillon</h2>
      <p className="cs-studio__lede">
        Crochetez un carré avec votre fil et votre crochet, puis comptez ce que vous obtenez
        vraiment. Tous les calculs de l’atelier partent de ces quatre nombres.
      </p>

      <div className="cs-studio__grid">
        <Field label="Mailles comptées">
          {({ id }) => (
            <NumberInput
              id={id}
              value={gauge.stitchCount}
              min={1}
              onValueChange={(value) => value !== null && setGauge({ stitchCount: value })}
            />
          )}
        </Field>

        <Field label="Rangs comptés">
          {({ id }) => (
            <NumberInput
              id={id}
              value={gauge.rowCount}
              min={1}
              onValueChange={(value) => value !== null && setGauge({ rowCount: value })}
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
                value !== null && setGauge({ swatchWidthCm: toCm(value, units) })
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
                value !== null && setGauge({ swatchHeightCm: toCm(value, units) })
              }
            />
          )}
        </Field>

        <Field label="Maille utilisée" hint={STITCHES[gauge.stitch].description}>
          {({ id }) => (
            <Select<StitchId>
              id={id}
              value={gauge.stitch}
              options={STITCH_ORDER.map((stitch) => ({
                value: stitch,
                label: `${STITCHES[stitch].name} (${STITCHES[stitch].abbreviation})`,
              }))}
              onValueChange={(value) => setGauge({ stitch: value })}
            />
          )}
        </Field>

        <Field
          label="Crochet"
          hint={
            isHookInRange(gauge.hookSizeMm, project.yarn.weight)
              ? `Dans la plage conseillée pour un fil ${YARN_WEIGHTS[project.yarn.weight].label}`
              : `Hors de la plage ${YARN_WEIGHTS[project.yarn.weight].hookRangeMm[0]}–${
                  YARN_WEIGHTS[project.yarn.weight].hookRangeMm[1]
                } mm conseillée pour ce fil — sans problème si c’est voulu`
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
              onValueChange={(value) => setGauge({ hookSizeMm: Number.parseFloat(value) })}
            />
          )}
        </Field>
      </div>

      {density ? (
        <p className="cs-studio__density">
          Soit <strong>{format2(density.stitches)}</strong> maille(s) par cm et{' '}
          <strong>{format2(density.rows)}</strong> rang(s) par cm.
        </p>
      ) : (
        <p className="cs-studio__warning">
          L’échantillon doit avoir une largeur et une hauteur supérieures à zéro pour que les
          calculs soient possibles.
        </p>
      )}
    </Surface>
  )
}

/** The gauge engine throws on a zero-sized swatch; the panel must not crash with it. */
function safeDensity(gauge: Gauge): { stitches: number; rows: number } | null {
  try {
    return { stitches: stitchesPerCm(gauge), rows: rowsPerCm(gauge) }
  } catch {
    return null
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10
const format2 = (value: number) =>
  (Math.round(value * 100) / 100).toString().replace('.', ',')
