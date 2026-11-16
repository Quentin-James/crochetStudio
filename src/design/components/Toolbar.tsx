import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import './Toolbar.css'

export function Toolbar({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="cs-toolbar" role="toolbar" aria-label={label}>
      {children}
    </div>
  )
}

export function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="cs-toolbar__group">{children}</div>
}

export function ToolbarSeparator() {
  return <span className="cs-toolbar__separator" aria-hidden="true" />
}

interface ToolbarButtonProps {
  label: string
  icon?: IconName
  /** Marks a toggle as on; omit for plain actions. */
  pressed?: boolean
  /** Hides the text, keeping it as the accessible name. */
  iconOnly?: boolean
  title?: string
  disabled?: boolean
  onClick: () => void
}

/** A compact control for a viewport toolbar: same height, same rhythm, always. */
export function ToolbarButton({
  label,
  icon,
  pressed,
  iconOnly = false,
  title,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`cs-toolbar__button${pressed ? ' cs-toolbar__button--on' : ''}${
        iconOnly ? ' cs-toolbar__button--icon' : ''
      }`}
      aria-pressed={pressed}
      aria-label={iconOnly ? label : undefined}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={16} />}
      {!iconOnly && <span>{label}</span>}
    </button>
  )
}
