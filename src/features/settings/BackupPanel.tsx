import { useRef, useState } from 'react'
import { formatRelative } from '../../core/dates'
import { getCategory } from '../../core/categories'
import {
  backupFilename,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  summariseBackup,
  type BackupDocument,
  type ImportMode,
} from '../../data/backup/backup'
import { Button, Dialog, Surface } from '../../design/components'
import { useSettings } from '../../app/SettingsProvider'
import './BackupPanel.css'

type Feedback = { tone: 'ok' | 'error'; message: string } | null

/**
 * Backup export and restore.
 *
 * This is the only way to move projects between the desktop and the iPad — there
 * is no server — so it is a primary feature rather than a hidden maintenance tool.
 */
export function BackupPanel() {
  const { settings, updateSettings } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [pendingImport, setPendingImport] = useState<BackupDocument | null>(null)

  const onExport = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const document_ = await exportBackup()
      downloadFile(serializeBackup(document_), backupFilename(document_.exportedAt))
      await updateSettings({ lastBackupAt: document_.exportedAt })
      setFeedback({
        tone: 'ok',
        message: `${document_.projects.length} projet${
          document_.projects.length === 1 ? '' : 's'
        } exporté${document_.projects.length === 1 ? '' : 's'}.`,
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'L’export a échoué.',
      })
    } finally {
      setBusy(false)
    }
  }

  const onFileChosen = async (file: File) => {
    setFeedback(null)
    const text = await file.text()
    const result = parseBackup(text)

    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.error })
      return
    }
    setPendingImport(result.document)
  }

  const runImport = async (mode: ImportMode) => {
    if (!pendingImport) return
    setBusy(true)
    try {
      const result = await importBackup(pendingImport, mode)
      setPendingImport(null)
      setFeedback({
        tone: 'ok',
        message:
          mode === 'replace'
            ? `Bibliothèque remplacée par ${
                result.projectsImported + result.projectsReplaced
              } projet(s).`
            : `${result.projectsImported} projet(s) ajouté(s), ${result.projectsReplaced} mis à jour.`,
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'La restauration a échoué.',
      })
    } finally {
      setBusy(false)
    }
  }

  const counts = pendingImport ? summariseBackup(pendingImport) : null

  return (
    <Surface padding="lg">
      <h2 className="cs-settings__heading">Sauvegarde et restauration</h2>
      <p className="cs-settings__body">
        Une sauvegarde est un seul fichier contenant tous vos projets, vos profils de taille et vos
        préférences. Gardez-en une à l’abri — et servez-vous-en pour transporter votre travail entre
        votre ordinateur et votre iPad, qui ont chacun leur propre bibliothèque locale.
      </p>

      <dl className="cs-settings__facts">
        <div>
          <dt>Dernier export</dt>
          <dd>{settings.lastBackupAt === null ? 'Jamais' : formatRelative(settings.lastBackupAt)}</dd>
        </div>
      </dl>

      <div className="cs-settings__actions">
        <Button variant="primary" icon="download" onClick={() => void onExport()} disabled={busy}>
          Exporter une sauvegarde
        </Button>
        <Button icon="upload" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          Restaurer depuis un fichier
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="cs-backup__file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Reset so choosing the same file twice fires change again.
            event.target.value = ''
            if (file) void onFileChosen(file)
          }}
        />
      </div>

      {feedback && (
        <p className={`cs-backup__feedback cs-backup__feedback--${feedback.tone}`} role="status">
          {feedback.message}
        </p>
      )}

      <Dialog
        open={pendingImport !== null}
        title="Restaurer cette sauvegarde ?"
        description={
          pendingImport
            ? `Créée ${formatRelative(pendingImport.exportedAt)} · ${
                pendingImport.projects.length
              } projet(s)${
                counts
                  ? ` : ${Object.entries(counts)
                      .filter(([, count]) => count > 0)
                      .map(
                        ([category, count]) =>
                          `${count} ${getCategory(category as 'dress').pluralLabel.toLowerCase()}`,
                      )
                      .join(', ')}`
                  : ''
              }`
            : ''
        }
        onClose={() => setPendingImport(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPendingImport(null)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={() => void runImport('merge')} disabled={busy}>
              Ajouter à ma bibliothèque
            </Button>
            <Button
              variant="primary"
              className="cs-button--destructive"
              onClick={() => void runImport('replace')}
              disabled={busy}
            >
              Tout remplacer
            </Button>
          </>
        }
      >
        <ul className="cs-backup__choices">
          <li>
            <strong>Ajouter à ma bibliothèque</strong> conserve ce que vous avez. Les projets
            enregistrés sous le même identifiant sont mis à jour depuis la sauvegarde, les autres
            sont ajoutés.
          </li>
          <li>
            <strong>Tout remplacer</strong> vide d’abord la bibliothèque de cet appareil, puis
            restaure la sauvegarde à l’identique, préférences incluses.
          </li>
        </ul>
      </Dialog>
    </Surface>
  )
}

function downloadFile(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Revoke on the next tick so Safari has started the download first.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
