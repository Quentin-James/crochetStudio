import { Icon } from './Icon'
import './StatusPill.css'

export type StatusTone = 'ok' | 'warning' | 'problem' | 'neutral'

interface StatusPillProps {
  tone: StatusTone
  children: string
  /** Hides the icon where space is tight. */
  compact?: boolean
}

const ICONS = {
  ok: 'check',
  warning: 'ruler',
  problem: 'ruler',
  neutral: 'chevronRight',
} as const

/**
 * A validation state, stated plainly.
 *
 * Used for calculation results and generation status: the tone is carried by a
 * word as well as a colour, because "it is fine" should be readable without
 * decoding a palette.
 */
export function StatusPill({ tone, children, compact = false }: StatusPillProps) {
  return (
    <span className={`cs-status cs-status--${tone}`}>
      {!compact && tone === 'ok' && <Icon name={ICONS.ok} size={13} />}
      {children}
    </span>
  )
}
