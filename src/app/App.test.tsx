// @vitest-environment jsdom
// An end-to-end check of the wiring: the real settings provider, the real Dexie
// database (backed by fake-indexeddb) and the real routes. It catches the class
// of breakage typechecking cannot — a provider that throws, a missing route, a
// live query that never resolves.
import 'fake-indexeddb/auto'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../core/defaults'
import { db } from '../data/db'
import { eraseAllData } from '../data/backup/backup'
import { createProject } from '../data/repositories/projectRepository'
import { ensureSettings } from '../data/repositories/settingsRepository'
import { App } from './App'

beforeEach(async () => {
  await db.open()
  await eraseAllData()
  await ensureSettings()
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('opens on the dashboard with the studio navigation', async () => {
    render(<App />)

    expect(await screen.findByText('Bienvenue dans Crochet Studio')).toBeDefined()

    // Each item renders a full and a compact label (one per layout), so the
    // links themselves are what's asserted rather than the label text.
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    const destinations = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(destinations).toEqual(['/', '/projects', '/pattern', '/3d', '/settings'])
  })

  it('invites the user to create a project when the library is empty', async () => {
    render(<App />)

    expect(await screen.findByText('Rien sur la table pour l’instant')).toBeDefined()
  })

  it('shows a stored project on the dashboard', async () => {
    await createProject({ name: 'Garden party dress', category: 'dress' }, DEFAULT_SETTINGS)

    render(<App />)

    await waitFor(async () => {
      expect(await screen.findByText('Garden party dress')).toBeDefined()
    })
    // The welcome copy changes once there is work in the library.
    expect(screen.getByText('Bon retour')).toBeDefined()
  })
})
