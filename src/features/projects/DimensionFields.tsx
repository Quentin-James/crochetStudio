import { getCategory } from '../../core/categories'
import { fromCm, toCm, unitLabel } from '../../core/units'
import type { Dimensions, ProjectCategory, UnitSystem } from '../../core/types'
import { Field, NumberInput } from '../../design/components'

interface DimensionFieldsProps {
  category: ProjectCategory
  dimensions: Dimensions
  units: UnitSystem
  onChange: (dimensions: Dimensions) => void
}

/**
 * The measurement inputs for a category, shared by the creation dialog and the
 * project detail page so both always ask for exactly the same thing.
 *
 * Values are displayed in the user's unit and converted back to centimetres —
 * the canonical storage unit — on every change.
 */
export function DimensionFields({
  category,
  dimensions,
  units,
  onChange,
}: DimensionFieldsProps) {
  const definition = getCategory(category)

  return (
    <>
      {definition.dimensions.map((dimension) => {
        const stored = dimensions[dimension.key]
        return (
          <Field
            key={dimension.key}
            label={dimension.label}
            hint={dimension.hint}
            suffix={unitLabel(units)}
          >
            {({ id }) => (
              <NumberInput
                id={id}
                value={stored === undefined ? null : round1(fromCm(stored, units))}
                min={round1(fromCm(dimension.minCm, units))}
                max={round1(fromCm(dimension.maxCm, units))}
                allowEmpty
                onValueChange={(value) => {
                  const next = { ...dimensions }
                  if (value === null) {
                    delete next[dimension.key]
                  } else {
                    next[dimension.key] = toCm(value, units)
                  }
                  onChange(next)
                }}
              />
            )}
          </Field>
        )
      })}
    </>
  )
}

const round1 = (value: number) => Math.round(value * 10) / 10
