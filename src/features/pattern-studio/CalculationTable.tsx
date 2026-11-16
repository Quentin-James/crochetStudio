import { useState } from 'react'
import type { Derivation } from '../../core/types'
import { Icon, StatusPill } from '../../design/components'
import './CalculationTable.css'

interface CalculationTableProps {
  derivations: readonly Derivation[]
}

/**
 * The calculation workspace.
 *
 * One row per calculated value, scannable at a glance: what was calculated, the
 * figure it produced, and whether it came out clean or needed adjusting. The
 * arithmetic — inputs, formula, raw result, every adjustment with its reason —
 * opens underneath, so the detail is always one click away and never in the way.
 */
export function CalculationTable({ derivations }: CalculationTableProps) {
  const [open, setOpen] = useState<string | null>(null)

  if (derivations.length === 0) {
    return (
      <p className="cs-calc__empty">
        Renseignez les mesures et l’échantillon : les calculs apparaîtront ici, détaillés.
      </p>
    )
  }

  return (
    <div className="cs-calc">
      <div className="cs-calc__head" aria-hidden="true">
        <span>Calcul</span>
        <span>Section</span>
        <span className="cs-calc__numeric">Résultat</span>
        <span>État</span>
      </div>

      <ul className="cs-calc__rows">
        {derivations.map((derivation, index) => {
          const key = `${derivation.label}-${index}`
          const expanded = open === key
          const [section, kind] = splitLabel(derivation.label)
          const adjusted = derivation.adjustments.filter(
            (adjustment) => adjustment.from !== adjustment.to,
          )

          return (
            <li key={key} className={`cs-calc__row${expanded ? ' cs-calc__row--open' : ''}`}>
              <button
                type="button"
                className="cs-calc__summary"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : key)}
              >
                <span className="cs-calc__kind">
                  <span className={`cs-calc__chevron${expanded ? ' cs-calc__chevron--open' : ''}`}>
                    <Icon name="chevronRight" size={14} />
                  </span>
                  {kind}
                </span>
                <span className="cs-calc__section">{section}</span>
                <span className="cs-calc__numeric cs-calc__result">{derivation.finalResult}</span>
                <span className="cs-calc__state">
                  {adjusted.length === 0 ? (
                    <StatusPill tone="ok">exact</StatusPill>
                  ) : (
                    <StatusPill tone="warning">
                      {adjusted.length === 1 ? '1 ajustement' : `${adjusted.length} ajustements`}
                    </StatusPill>
                  )}
                </span>
              </button>

              {expanded && (
                <div className="cs-calc__detail">
                  <p className="cs-calc__formula">{derivation.formula}</p>

                  <ul className="cs-calc__inputs">
                    {Object.entries(derivation.inputs).map(([name, value]) => (
                      <li key={name}>
                        <span>{name}</span>
                        <strong>{formatValue(value)}</strong>
                      </li>
                    ))}
                  </ul>

                  <p className="cs-calc__raw">
                    Résultat brut&nbsp;: <strong>{formatValue(derivation.rawResult)}</strong>
                    {adjusted.length === 0 && ' — aucun ajustement nécessaire'}
                  </p>

                  {derivation.adjustments.length > 0 && (
                    <ol className="cs-calc__adjustments">
                      {derivation.adjustments.map((adjustment, adjustmentIndex) => (
                        <li key={`${adjustment.reason}-${adjustmentIndex}`}>
                          <span className="cs-calc__arrow" aria-hidden="true">
                            ↳
                          </span>
                          <span>{adjustment.reason}</span>
                          {adjustment.from !== adjustment.to && (
                            <span className="cs-calc__change">
                              {formatValue(adjustment.from)} → {formatValue(adjustment.to)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Generator labels read "Corsage — mailles du tour"; the two halves are columns. */
function splitLabel(label: string): [section: string, kind: string] {
  const parts = label.split(' — ')
  if (parts.length === 2) return [parts[0] as string, parts[1] as string]
  return ['—', label]
}

/** French decimal separator, and no trailing zeroes on whole numbers. */
function formatValue(value: number | string): string {
  if (typeof value === 'string') return value
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
}
