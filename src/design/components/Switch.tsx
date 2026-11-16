import { useId } from 'react'
import './Switch.css'

interface SwitchProps {
  checked: boolean
  label: string
  hint?: string
  onCheckedChange: (checked: boolean) => void
}

/** An on/off control with a real checkbox underneath, so it is keyboard-usable. */
export function Switch({ checked, label, hint, onCheckedChange }: SwitchProps) {
  const id = useId()

  return (
    <div className="cs-switch">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="cs-switch__input"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <label className="cs-switch__label" htmlFor={id}>
        <span className="cs-switch__track" aria-hidden="true">
          <span className="cs-switch__thumb" />
        </span>
        <span className="cs-switch__text">
          {label}
          {hint && <span className="cs-switch__hint">{hint}</span>}
        </span>
      </label>
    </div>
  )
}
