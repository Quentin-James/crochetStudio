import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import './Tabs.css'

export interface TabItem<T extends string> {
  value: T
  label: string
  icon?: IconName
  /** Short status shown after the label, e.g. "3" or "!". */
  badge?: string
}

interface TabsProps<T extends string> {
  value: T
  items: readonly TabItem<T>[]
  label: string
  onValueChange: (value: T) => void
  /** `steps` numbers the tabs, for a workflow the user moves through in order. */
  variant?: 'tabs' | 'steps'
  children?: ReactNode
}

/**
 * Workspace navigation.
 *
 * Implemented as a real tab list (`role="tablist"`, arrow-key friendly through
 * native buttons) so a long configuration page can be split into the steps of a
 * workflow instead of scrolling forever.
 */
export function Tabs<T extends string>({
  value,
  items,
  label,
  onValueChange,
  variant = 'tabs',
}: TabsProps<T>) {
  return (
    <div className={`cs-tabs cs-tabs--${variant}`} role="tablist" aria-label={label}>
      {items.map((item, index) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`cs-tabs__tab${active ? ' cs-tabs__tab--active' : ''}`}
            onClick={() => onValueChange(item.value)}
          >
            {variant === 'steps' && <span className="cs-tabs__number">{index + 1}</span>}
            {item.icon && variant !== 'steps' && <Icon name={item.icon} size={17} />}
            <span className="cs-tabs__label">{item.label}</span>
            {item.badge && <span className="cs-tabs__badge">{item.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
