import './ProgressBar.css'

interface ProgressBarProps {
  completed: number
  total: number
  /** Hides the "x of y rows" caption, for compact cards. */
  compact?: boolean
}

/**
 * Row progress. Shows "not started" honestly rather than a 0% bar pretending to
 * be progress, and reports when there is no pattern to make progress against.
 */
export function ProgressBar({ completed, total, compact = false }: ProgressBarProps) {
  const hasPattern = total > 0
  const ratio = hasPattern ? Math.min(1, Math.max(0, completed / total)) : 0
  const percent = Math.round(ratio * 100)

  return (
    <div className="cs-progress">
      <div
        className="cs-progress__track"
        role="progressbar"
        aria-valuenow={hasPattern ? percent : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Rangs crochetés"
      >
        <div className="cs-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      {!compact && (
        <p className="cs-progress__caption">
          {hasPattern ? `${completed} rangs sur ${total} · ${percent} %` : 'Aucun rang pour l’instant'}
        </p>
      )}
    </div>
  )
}
