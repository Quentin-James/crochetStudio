import { useEffect, useState } from 'react'
import { categoryList, getCategory } from '../../core/categories'
import { unitLabel } from '../../core/units'
import type { Dimensions, ProjectCategory, ProjectDraft, UnitSystem } from '../../core/types'
import { Button, Dialog, Field, TextInput } from '../../design/components'
import { DimensionFields } from './DimensionFields'
import './NewProjectDialog.css'

interface NewProjectDialogProps {
  open: boolean
  units: UnitSystem
  busy?: boolean
  onCancel: () => void
  onCreate: (draft: ProjectDraft) => void
}

/**
 * Creation form.
 *
 * Dimension fields are driven by the category definition, so each category asks
 * for what it actually needs and the stored document never carries a measurement
 * that doesn't apply. Values are entered in the user's unit and converted to the
 * canonical centimetres on the way out.
 */
export function NewProjectDialog({
  open,
  units,
  busy = false,
  onCancel,
  onCreate,
}: NewProjectDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ProjectCategory>('dress')
  const [dimensions, setDimensions] = useState<Dimensions>(getCategory('dress').defaults)

  // Reset to a clean form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setName('')
      setCategory('dress')
      setDimensions(getCategory('dress').defaults)
    }
  }, [open])

  const chooseCategory = (next: ProjectCategory) => {
    setCategory(next)
    setDimensions(getCategory(next).defaults)
  }

  const submit = () => {
    onCreate({ name, category, dimensions })
  }

  return (
    <Dialog
      open={open}
      size="md"
      title="Nouveau projet"
      description="Donnez-lui un nom, choisissez ce que vous crochetez, puis indiquez les mesures finies. Tout reste modifiable."
      onClose={onCancel}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button variant="primary" icon="plus" onClick={submit} disabled={busy}>
            {busy ? 'Création…' : 'Créer le projet'}
          </Button>
        </>
      }
    >
      <div className="cs-new-project">
        <Field label="Nom du projet" hint="Laissez vide et nous le nommerons pour vous">
          {({ id }) => (
            <TextInput
              id={id}
              value={name}
              onValueChange={setName}
              placeholder="Robe d’été"
              autoFocus
              maxLength={80}
            />
          )}
        </Field>

        <fieldset className="cs-new-project__categories">
          <legend>Qu’allez-vous crocheter ?</legend>
          <div className="cs-new-project__category-grid">
            {categoryList().map((option) => (
              <button
                key={option.id}
                type="button"
                className={`cs-category-option${
                  option.id === category ? ' cs-category-option--active' : ''
                }`}
                aria-pressed={option.id === category}
                onClick={() => chooseCategory(option.id)}
              >
                <span
                  className="cs-category-option__swatch"
                  style={{ background: `var(${option.colorVar})` }}
                  aria-hidden="true"
                />
                <span className="cs-category-option__label">{option.label}</span>
                <span className="cs-category-option__description">{option.description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="cs-new-project__dimensions">
          <h3 className="cs-new-project__subheading">
            Mesures finies
            <span className="cs-new-project__unit">en {unitLabel(units)}</span>
          </h3>
          <div className="cs-new-project__dimension-grid">
            <DimensionFields
              category={category}
              dimensions={dimensions}
              units={units}
              onChange={setDimensions}
            />
          </div>
          <p className="cs-new-project__note">
            Les mailles et les rangs seront calculés depuis ces mesures et votre échantillon dans
            l’atelier de motifs. L’échantillon part de vos réglages et reste modifiable projet par
            projet.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
