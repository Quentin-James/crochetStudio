import { useState } from 'react'
import { findColor, paletteOf, paintSection, paintStripes, resolveSectionColor } from '../../core/colors'
import type { Id, Project } from '../../core/types'
import { Button, Field, NumberInput, Select } from '../../design/components'
import type { ProjectPatch } from '../../data/repositories/projectRepository'
import './ColorPlacement.css'

interface ColorPlacementProps {
  project: Project
  update: (patch: ProjectPatch) => void
  /** The palette colour currently armed in the palette panel. */
  selectedColorId: Id | null
}

/**
 * Where the colours go.
 *
 * Two ways, because crochet works both ways: paint a whole section (a bodice in
 * one colour, a skirt in another), or lay stripes across a range of rows. Both
 * write to the pattern, which is what the 3D model reads — so the model shows
 * exactly what the written pattern says.
 */
export function ColorPlacement({ project, update, selectedColorId }: ColorPlacementProps) {
  const sections = project.pattern.sections
  const palette = paletteOf(project.yarn)

  const [stripeSection, setStripeSection] = useState<Id | ''>('')
  const [every, setEvery] = useState(6)
  const [width, setWidth] = useState(2)

  if (sections.length === 0) {
    return (
      <p className="cs-placement__empty">
        Générez le motif dans l’atelier de motifs : les couleurs se posent sur ses sections et ses
        rangs.
      </p>
    )
  }

  const target = sections.find((section) => section.id === stripeSection) ?? sections[0]

  const applyStripes = () => {
    if (!target) return
    update({
      pattern: paintStripes(project.pattern, {
        sectionId: target.id,
        colorId: selectedColorId,
        fromRow: 1,
        toRow: target.rows.length,
        every,
        width,
      }),
    })
  }

  const colorName = selectedColorId
    ? (findColor(project.yarn, selectedColorId)?.label ?? 'couleur')
    : 'couleur principale'

  return (
    <div className="cs-placement">
      <p className="cs-placement__lede">
        Choisissez une couleur dans la palette, puis cliquez sur une section pour la peindre.
      </p>

      <ul className="cs-placement__sections">
        {sections.map((section) => {
          const sectionColor = resolveSectionColor(project.yarn, section)
          const striped = section.rows.some((row) => row.colorId !== null)

          return (
            <li key={section.id}>
              <button
                type="button"
                className="cs-placement__section"
                onClick={() =>
                  update({ pattern: paintSection(project.pattern, section.id, selectedColorId) })
                }
                title={`Peindre « ${section.name} » avec ${colorName}`}
              >
                <span
                  className="cs-placement__swatch"
                  style={{ background: sectionColor }}
                  aria-hidden="true"
                />
                <span className="cs-placement__section-text">
                  <span className="cs-placement__section-name">{section.name}</span>
                  <span className="cs-placement__section-meta">
                    {section.rows.length} rang{section.rows.length === 1 ? '' : 's'}
                    {striped && ' · rayures posées'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {palette.length > 0 && (
        <div className="cs-placement__stripes">
          <h4 className="cs-placement__subheading">Rayures</h4>
          <div className="cs-placement__stripe-grid">
            <Field label="Section">
              {({ id }) => (
                <Select<string>
                  id={id}
                  value={target?.id ?? ''}
                  options={sections.map((section) => ({ value: section.id, label: section.name }))}
                  onValueChange={(value) => setStripeSection(value)}
                />
              )}
            </Field>
            <Field label="Tous les" suffix="rangs">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={every}
                  min={1}
                  onValueChange={(value) => value !== null && setEvery(Math.max(1, value))}
                />
              )}
            </Field>
            <Field label="Épaisseur" suffix="rangs">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={width}
                  min={1}
                  onValueChange={(value) => value !== null && setWidth(Math.max(1, value))}
                />
              )}
            </Field>
          </div>
          <Button size="sm" icon="yarn" onClick={applyStripes}>
            Rayer avec {colorName}
          </Button>
        </div>
      )}
    </div>
  )
}
