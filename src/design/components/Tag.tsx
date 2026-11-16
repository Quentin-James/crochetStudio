import type { ReactNode } from 'react'
import './Tag.css'

interface TagProps {
  children: ReactNode
  /** A CSS custom property name providing the dot colour, e.g. `--cat-dress`. */
  colorVar?: string
  tone?: 'plain' | 'accent'
}

export function Tag({ children, colorVar, tone = 'plain' }: TagProps) {
  return (
    <span className={`cs-tag cs-tag--${tone}`}>
      {colorVar && (
        <span className="cs-tag__dot" style={{ background: `var(${colorVar})` }} aria-hidden="true" />
      )}
      {children}
    </span>
  )
}
