import type { SaveStatus } from '../../data/autosave'
import { Icon } from './Icon'
import './SaveIndicator.css'

interface SaveIndicatorProps {
  status: SaveStatus
  /** Last successful save, shown once the "Saved" flash has settled. */
  lastSavedAt?: number | null
}

const LABELS: Record<SaveStatus, string> = {
  idle: 'Tout est enregistré',
  pending: 'Modifications en attente',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Échec de l’enregistrement',
}

/** Honest autosave state — it reports what the database actually did. */
export function SaveIndicator({ status, lastSavedAt }: SaveIndicatorProps) {
  const showCheck = status === 'saved' || (status === 'idle' && lastSavedAt != null)

  return (
    <span className={`cs-save cs-save--${status}`} role="status" aria-live="polite">
      {showCheck && <Icon name="check" size={14} />}
      {LABELS[status]}
    </span>
  )
}
