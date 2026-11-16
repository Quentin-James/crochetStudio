import { useId } from 'react'
import './Slider.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Formatted value shown beside the label, e.g. "1,4 ×". */
  display?: string
  onValueChange: (value: number) => void
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.1,
  display,
  onValueChange,
}: SliderProps) {
  const id = useId()

  return (
    <div className="cs-slider">
      <div className="cs-slider__head">
        <label className="cs-slider__label" htmlFor={id}>
          {label}
        </label>
        <span className="cs-slider__value">{display ?? value}</span>
      </div>
      <input
        id={id}
        type="range"
        className="cs-slider__input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onValueChange(Number.parseFloat(event.target.value))}
      />
    </div>
  )
}
