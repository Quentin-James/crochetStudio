import type { ReactNode } from 'react'
import './PageHeader.css'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  lede?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, lede, actions }: PageHeaderProps) {
  return (
    <header className="cs-page-header">
      <div className="cs-page-header__text">
        {eyebrow && <p className="cs-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="cs-page-header__title">{title}</h1>
        {lede && <p className="cs-page-header__lede">{lede}</p>}
      </div>
      {actions && <div className="cs-page-header__actions">{actions}</div>}
    </header>
  )
}
