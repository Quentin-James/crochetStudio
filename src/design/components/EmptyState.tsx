import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import './EmptyState.css'

interface EmptyStateProps {
  icon: IconName
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="cs-empty">
      <span className="cs-empty__icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <h2 className="cs-empty__title">{title}</h2>
      <p className="cs-empty__description">{description}</p>
      {action && <div className="cs-empty__action">{action}</div>}
    </div>
  )
}
