import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DEFAULT_SETTINGS } from '../core/defaults'
import type { AppSettings, UnitSystem } from '../core/types'
import { ensureSettings, patchSettings, readSettings } from '../data/repositories/settingsRepository'
import './SettingsProvider.css'

interface SettingsContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/**
 * Loads settings from the database and keeps them live.
 *
 * The database is the single source of truth: `updateSettings` writes, and the
 * live query pushes the new value back into React. There is no second copy of
 * settings held in component state that could drift.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [initError, setInitError] = useState<string | null>(null)
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    ensureSettings()
      .then(() => setInitialised(true))
      .catch((error: unknown) =>
        setInitError(error instanceof Error ? error.message : String(error)),
      )
  }, [])

  const settings = useLiveQuery(() => readSettings(), [], undefined)

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: settings ?? DEFAULT_SETTINGS,
      updateSettings: async (patch) => {
        await patchSettings(patch)
      },
    }),
    [settings],
  )

  if (initError) {
    return (
      <div className="cs-boot cs-boot--error">
        <h1>Crochet Studio ne parvient pas à ouvrir sa base locale</h1>
        <p>
          Vos projets sont enregistrés dans le stockage de ce navigateur. En navigation privée, ou
          si le stockage est bloqué pour ce site, rien ne peut être sauvegardé.
        </p>
        <p className="cs-boot__detail">{initError}</p>
      </div>
    )
  }

  if (!initialised || settings === undefined) {
    return (
      <div className="cs-boot">
        <p>Ouverture de votre atelier…</p>
      </div>
    )
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used inside a SettingsProvider')
  }
  return context
}

/** Convenience for the many components that only need the unit system. */
export function useUnits(): UnitSystem {
  return useSettings().settings.units
}
