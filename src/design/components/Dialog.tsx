import { useEffect, useRef, type ReactNode } from 'react'
import './Dialog.css'

interface DialogProps {
  open: boolean
  title: string
  description?: string
  /** Rendered in the footer, right-aligned. */
  actions: ReactNode
  onClose: () => void
  children?: ReactNode
  /** Widens the panel for forms with two columns. */
  size?: 'sm' | 'md'
}

/**
 * Modal built on the native `<dialog>` element.
 *
 * Using the platform element rather than a hand-rolled overlay gives correct
 * focus trapping, Escape handling and top-layer stacking for free — all of which
 * behave identically in Safari on iPad, which is where hand-rolled modals
 * usually break.
 */
export function Dialog({
  open,
  title,
  description,
  actions,
  onClose,
  children,
  size = 'sm',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Fires for Escape as well as programmatic close, so one handler covers both.
    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    element.addEventListener('cancel', handleCancel)
    return () => element.removeEventListener('cancel', handleCancel)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      className={`cs-dialog cs-dialog--${size}`}
      aria-labelledby="cs-dialog-title"
      // Clicking the backdrop (the dialog element itself, outside the panel) closes.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className="cs-dialog__panel">
        <header className="cs-dialog__header">
          <h2 id="cs-dialog-title" className="cs-dialog__title">
            {title}
          </h2>
          {description && <p className="cs-dialog__description">{description}</p>}
        </header>

        {children && <div className="cs-dialog__body">{children}</div>}

        <footer className="cs-dialog__footer">{actions}</footer>
      </div>
    </dialog>
  )
}
