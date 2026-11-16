import type { HTMLAttributes, ReactNode } from 'react'
import './Surface.css'

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** `raised` for cards on the app background, `sunken` for inset panels. */
  tone?: 'raised' | 'sunken' | 'accent'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

/** The one container used for every card and panel, so radii and shadows stay consistent. */
export function Surface({
  tone = 'raised',
  padding = 'md',
  className,
  children,
  ...rest
}: SurfaceProps) {
  const classes = [
    'cs-surface',
    `cs-surface--${tone}`,
    `cs-surface--pad-${padding}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
