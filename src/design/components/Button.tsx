import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import './Button.css'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  /** Renders icon-only; the label is still required and used as the accessible name. */
  iconOnly?: boolean
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'cs-button',
    `cs-button--${variant}`,
    `cs-button--${size}`,
    iconOnly ? 'cs-button--icon-only' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      aria-label={iconOnly && typeof children === 'string' ? children : undefined}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18} />}
      {iconOnly ? null : <span>{children}</span>}
    </button>
  )
}
