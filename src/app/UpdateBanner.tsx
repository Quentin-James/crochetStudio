import { Button } from '../design/components'
import { useServiceWorker } from './useServiceWorker'
import './UpdateBanner.css'

/**
 * Offers an update when a newer build is cached, and confirms once the app is
 * ready to work offline. Both are quiet, dismissible, and never block the page.
 */
export function UpdateBanner() {
  const { updateReady, offlineReady, applyUpdate, dismiss } = useServiceWorker()

  if (!updateReady && !offlineReady) return null

  if (updateReady) {
    return (
      <div className="cs-update" role="status">
        <p className="cs-update__text">
          Une nouvelle version de l’atelier est prête. Vos projets ne sont pas touchés.
        </p>
        <div className="cs-update__actions">
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Plus tard
          </Button>
          <Button size="sm" variant="primary" icon="refresh" onClick={applyUpdate}>
            Recharger
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="cs-update cs-update--quiet" role="status">
      <p className="cs-update__text">L’atelier est maintenant disponible hors connexion.</p>
    </div>
  )
}
