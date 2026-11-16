import type { Derivation } from '../../core/types'
import './DerivationList.css'

interface DerivationListProps {
  derivations: readonly Derivation[]
}

/**
 * Shows the arithmetic behind every count.
 *
 * The specification requires calculations to be transparent: each entry gives
 * the formula, the inputs it used, the raw result and each adjustment with its
 * reason, so the user can follow 46 cm → 92 mailles and see exactly where a
 * rounding or a repeat changed the figure.
 */
export function DerivationList({ derivations }: DerivationListProps) {
  if (derivations.length === 0) {
    return (
      <p className="cs-derivations__empty">
        Renseignez les mesures et l’échantillon pour voir les calculs.
      </p>
    )
  }

  return (
    <ul className="cs-derivations">
      {derivations.map((derivation, index) => (
        <li key={`${derivation.label}-${index}`} className="cs-derivation">
          <div className="cs-derivation__head">
            <h4 className="cs-derivation__label">{derivation.label}</h4>
            <span className="cs-derivation__result">{derivation.finalResult}</span>
          </div>

          <p className="cs-derivation__formula">{derivation.formula}</p>

          <ul className="cs-derivation__inputs">
            {Object.entries(derivation.inputs).map(([name, value]) => (
              <li key={name}>
                <span>{name}</span>
                <strong>{formatValue(value)}</strong>
              </li>
            ))}
          </ul>

          <p className="cs-derivation__raw">
            Résultat brut&nbsp;: <strong>{formatValue(derivation.rawResult)}</strong>
          </p>

          {derivation.adjustments.length > 0 && (
            <ul className="cs-derivation__adjustments">
              {derivation.adjustments.map((adjustment, adjustmentIndex) => (
                <li key={`${adjustment.reason}-${adjustmentIndex}`}>
                  <span className="cs-derivation__arrow" aria-hidden="true">
                    ↳
                  </span>
                  {adjustment.reason}
                  {adjustment.from !== adjustment.to && (
                    <>
                      {' '}
                      <span className="cs-derivation__change">
                        {formatValue(adjustment.from)} → {formatValue(adjustment.to)}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

/** French decimal separator, and no trailing zeroes on whole numbers. */
function formatValue(value: number | string): string {
  if (typeof value === 'string') return value
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
}
