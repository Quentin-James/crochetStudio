import './SegmentedControl.css'

export interface Segment<T extends string> {
  value: T
  label: string
  /** Optional count badge, e.g. the number of projects in a category. */
  count?: number
}

interface SegmentedControlProps<T extends string> {
  value: T
  segments: readonly Segment<T>[]
  onValueChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
}

/** Radio-group style switch used for category filters, sorting and units. */
export function SegmentedControl<T extends string>({
  value,
  segments,
  onValueChange,
  label,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`cs-segmented cs-segmented--${size}`}
      role="radiogroup"
      aria-label={label}
    >
      {segments.map((segment) => {
        const active = segment.value === value
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`cs-segmented__item${active ? ' cs-segmented__item--active' : ''}`}
            onClick={() => onValueChange(segment.value)}
          >
            <span>{segment.label}</span>
            {segment.count !== undefined && (
              <span className="cs-segmented__count">{segment.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
