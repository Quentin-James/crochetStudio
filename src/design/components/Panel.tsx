import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import './Panel.css'

interface PanelProps {
  title: string
  /** Short line under the title. Keep it to one sentence. */
  hint?: string
  /** Shown on the right of the header, e.g. a status or a value. */
  aside?: ReactNode
  /** Collapsible panels start open unless told otherwise. */
  collapsible?: boolean
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A titled section inside a workspace panel.
 *
 * Collapsible by default for advanced settings, so a properties column can hold
 * a lot without becoming a wall — the user opens what they need.
 */
export function Panel({
  title,
  hint,
  aside,
  collapsible = false,
  defaultOpen = true,
  children,
}: PanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  if (!collapsible) {
    return (
      <section className="cs-panel">
        <header className="cs-panel__head">
          <div className="cs-panel__titles">
            <h3 className="cs-panel__title">{title}</h3>
            {hint && <p className="cs-panel__hint">{hint}</p>}
          </div>
          {aside && <div className="cs-panel__aside">{aside}</div>}
        </header>
        <div className="cs-panel__body">{children}</div>
      </section>
    )
  }

  return (
    <section className={`cs-panel${open ? '' : ' cs-panel--closed'}`}>
      <header className="cs-panel__head">
        <button
          type="button"
          className="cs-panel__toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
        >
          <span className={`cs-panel__chevron${open ? ' cs-panel__chevron--open' : ''}`}>
            <Icon name="chevronRight" size={16} />
          </span>
          <span className="cs-panel__titles">
            <span className="cs-panel__title">{title}</span>
            {hint && <span className="cs-panel__hint">{hint}</span>}
          </span>
        </button>
        {aside && <div className="cs-panel__aside">{aside}</div>}
      </header>
      {open && (
        <div className="cs-panel__body" id={contentId}>
          {children}
        </div>
      )}
    </section>
  )
}
