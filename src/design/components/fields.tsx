import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import './fields.css'

/* ------------------------------------------------------------------- Field -- */

interface FieldProps {
  label: string
  hint?: string
  /** Shown instead of the hint when set, and marks the control as invalid. */
  error?: string
  /** Trailing unit or badge inside the control, e.g. "cm". */
  suffix?: string
  children: (props: { id: string; invalid: boolean }) => ReactNode
}

/** Label + control + hint/error. Every form control in the app uses this wrapper. */
export function Field({ label, hint, error, suffix, children }: FieldProps) {
  const id = useId()
  const invalid = Boolean(error)

  return (
    <div className={`cs-field${invalid ? ' cs-field--invalid' : ''}`}>
      <label className="cs-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="cs-field__control">
        {children({ id, invalid })}
        {suffix && <span className="cs-field__suffix">{suffix}</span>}
      </div>
      {(error || hint) && (
        <p className={`cs-field__hint${invalid ? ' cs-field__hint--error' : ''}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- TextInput -- */

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onValueChange: (value: string) => void
}

export function TextInput({ value, onValueChange, className, ...rest }: TextInputProps) {
  return (
    <input
      type="text"
      className={`cs-input${className ? ` ${className}` : ''}`}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
      {...rest}
    />
  )
}

/* ---------------------------------------------------------------- TextArea -- */

interface TextAreaProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  rows?: number
  placeholder?: string
}

export function TextArea({ id, value, onValueChange, rows = 4, placeholder }: TextAreaProps) {
  return (
    <textarea
      id={id}
      className="cs-input cs-input--textarea"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onValueChange(event.target.value)}
    />
  )
}

/* -------------------------------------------------------------- NumberInput -- */

interface NumberInputProps {
  id?: string
  value: number | null
  onValueChange: (value: number | null) => void
  min?: number
  max?: number
  placeholder?: string
  /** Allows an empty control, reported as null (e.g. an optional circumference). */
  allowEmpty?: boolean
}

/**
 * Numeric input that keeps what the user typed as text while editing.
 *
 * Parsing on every keystroke and writing the number back would fight the user
 * mid-entry ("4." becoming "4", a leading "-" vanishing), so the raw string is
 * the source of truth until it parses, and only valid numbers are reported up.
 */
export function NumberInput({
  id,
  value,
  onValueChange,
  min,
  max,
  placeholder,
  allowEmpty = false,
}: NumberInputProps) {
  const [text, setText] = useState(() => (value === null ? '' : String(value)))
  const [editing, setEditing] = useState(false)

  // Adopt external changes (size switch, unit change) only while not being typed in.
  useEffect(() => {
    if (!editing) setText(value === null ? '' : String(value))
  }, [value, editing])

  return (
    <input
      id={id}
      className="cs-input cs-input--number"
      // `text` rather than `number`: a native number input reports "" for
      // half-typed values like "4.", which would wipe the digits mid-entry.
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      aria-valuemin={min}
      aria-valuemax={max}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false)
        setText(value === null ? '' : String(value))
      }}
      onChange={(event) => {
        const raw = event.target.value
        setText(raw)

        if (raw.trim() === '') {
          if (allowEmpty) onValueChange(null)
          return
        }

        const parsed = Number.parseFloat(raw.replace(',', '.'))
        if (Number.isFinite(parsed)) onValueChange(parsed)
      }}
    />
  )
}

/* ------------------------------------------------------------------ Select -- */

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectProps<T extends string> {
  id?: string
  value: T
  options: readonly SelectOption<T>[]
  onValueChange: (value: T) => void
}

export function Select<T extends string>({ id, value, options, onValueChange }: SelectProps<T>) {
  return (
    <div className="cs-select">
      <select
        id={id}
        className="cs-input cs-select__control"
        value={value}
        onChange={(event) => onValueChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="cs-select__chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="m6 9.5 6 6 6-6" />
      </svg>
    </div>
  )
}

/* --------------------------------------------------------------- ColorInput -- */

interface ColorInputProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  /** Quick-pick swatches shown next to the native picker. */
  presets?: readonly string[]
}

export function ColorInput({ id, value, onValueChange, presets = [] }: ColorInputProps) {
  return (
    <div className="cs-color">
      <input
        id={id}
        className="cs-color__picker"
        type="color"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {presets.length > 0 && (
        <div className="cs-color__presets">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`cs-color__preset${
                preset.toLowerCase() === value.toLowerCase() ? ' cs-color__preset--active' : ''
              }`}
              style={{ background: preset }}
              aria-label={`Utiliser la couleur ${preset}`}
              onClick={() => onValueChange(preset)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
