// @vitest-environment jsdom
// Drives the Pattern Studio through the real UI: a real project in a real
// IndexedDB, the real calculation engine, the real components. It is the closest
// thing to opening the app and working through the steps.
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../app/App'
import { DEFAULT_SETTINGS } from '../../core/defaults'
import { eraseAllData } from '../../data/backup/backup'
import { db } from '../../data/db'
import { createProject, setActiveProject } from '../../data/repositories/projectRepository'
import { ensureSettings } from '../../data/repositories/settingsRepository'

beforeEach(async () => {
  await db.open()
  await eraseAllData()
  await ensureSettings()
})

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
})

/** Opens a project in the studio and navigates there, as the app itself does. */
async function openStudioWith(name: string, category: 'dress' | 'bag' | 'accessory') {
  const project = await createProject({ name, category }, DEFAULT_SETTINGS)
  await setActiveProject(project.id)
  window.history.pushState({}, '', '/pattern')
  render(<App />)
  return project
}

/** Moves to one of the workflow steps. */
async function goToStep(label: string) {
  const tab = await screen.findByRole('tab', { name: new RegExp(label) })
  fireEvent.click(tab)
  await waitFor(() => expect(tab.getAttribute('aria-selected')).toBe('true'))
}

/** Generates the pattern and lands on the pattern step. */
async function generate() {
  const [button] = await screen.findAllByRole('button', { name: 'Générer le motif' })
  fireEvent.click(button as HTMLElement)
  await waitFor(() => expect(screen.getAllByText(/rangs/).length).toBeGreaterThan(0))
}

describe('Pattern Studio', () => {
  it('asks for a project when none is open', async () => {
    window.history.pushState({}, '', '/pattern')
    render(<App />)

    expect(await screen.findByText('Aucun projet ouvert')).toBeDefined()
  })

  it('opens on the gauge step and summarises the project', async () => {
    await openStudioWith('Robe du dimanche', 'dress')

    expect(await screen.findByText('Robe du dimanche')).toBeDefined()
    expect(await screen.findByText(/maille\(s\) par cm/)).toBeDefined()
    // The step list is the workflow, in order.
    const steps = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(steps).toEqual([
      '1Échantillon',
      '2Mesures',
      '3Taille',
      '4Contraintes',
      expect.stringContaining('Génération'),
      expect.stringContaining('Calculs'),
      expect.stringContaining('Motif'),
    ])
  })

  it('shows the arithmetic, with the detail one click away', async () => {
    await openStudioWith('Robe du dimanche', 'dress')
    await goToStep('Calculs')

    // Each calculation is one scannable row...
    const row = await screen.findByRole('button', { name: /Corsage.*184/s })
    expect(row).toBeDefined()

    // ...and the formula is revealed on demand, not by default.
    expect(
      screen.queryByText('largeur × (mailles de l’échantillon ÷ largeur de l’échantillon)'),
    ).toBeNull()

    fireEvent.click(row)

    expect(
      await screen.findByText('largeur × (mailles de l’échantillon ÷ largeur de l’échantillon)'),
    ).toBeDefined()
  })

  it('generates the dress sections when asked', async () => {
    await openStudioWith('Robe du dimanche', 'dress')
    await generate()

    await waitFor(() => expect(screen.getByText('Corsage')).toBeDefined())
    expect(screen.getByText('Jupe')).toBeDefined()
    expect(screen.getByText('Bordure de l’ourlet')).toBeDefined()
    expect(screen.getAllByText('184 br (184 m)').length).toBeGreaterThan(0)
  })

  it('keeps the totals visible in the summary bar at every step', async () => {
    await openStudioWith('Sac du marché', 'bag')
    await generate()

    const summary = screen.getByText('rangs').parentElement?.parentElement
    expect(summary?.textContent).toMatch(/\d+\s*rangs/)
    expect(summary?.textContent).toMatch(/mailles/)
    expect(summary?.textContent).toMatch(/m de fil estimés/)

    // The totals follow you to another step.
    await goToStep('Contraintes')
    expect(screen.getByText('rangs')).toBeDefined()
  })

  it('locks a row when its stitch count is edited by hand', async () => {
    await openStudioWith('Écharpe', 'accessory')
    await generate()
    await waitFor(() => expect(screen.getByText('Panneau')).toBeDefined())

    fireEvent.change(screen.getByLabelText('Mailles au rang 2'), { target: { value: '44' } })

    await waitFor(() =>
      expect(screen.getByLabelText('Rendre le rang 2 au calcul automatique')).toBeDefined(),
    )
  })

  it('warns instead of recalculating silently once a row is locked', async () => {
    await openStudioWith('Écharpe', 'accessory')
    await generate()
    await waitFor(() => expect(screen.getByText('Panneau')).toBeDefined())

    fireEvent.change(screen.getByLabelText('Mailles au rang 2'), { target: { value: '44' } })
    await waitFor(() =>
      expect(screen.getByLabelText('Rendre le rang 2 au calcul automatique')).toBeDefined(),
    )

    await goToStep('Mesures')
    fireEvent.change(screen.getByLabelText('Largeur'), { target: { value: '40' } })

    // The header and the summary both report that the pattern no longer matches.
    await waitFor(() => expect(screen.getByText('À recalculer')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: /Recalculer/ }))

    expect(await screen.findByText(/à vérifier/)).toBeDefined()
    expect(screen.getByText(/rang 2 : vous avez fixé 44 mailles/)).toBeDefined()
  })

  it('tracks progress when a row is ticked off', async () => {
    await openStudioWith('Écharpe', 'accessory')
    await generate()
    await waitFor(() => expect(screen.getByText('Panneau')).toBeDefined())

    fireEvent.click(screen.getByLabelText('Rang 3 crocheté'))

    await waitFor(() => expect(screen.getByText(/3 rangs sur \d+/)).toBeDefined())
  })

  it('applies a standard size to the project measurements', async () => {
    await openStudioWith('Robe du dimanche', 'dress')
    await goToStep('Taille')

    const sizes = await screen.findByRole('radiogroup', { name: 'Taille active' })
    fireEvent.click(within(sizes).getByRole('radio', { name: 'XL' }))
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer aux mesures du projet' }))

    await goToStep('Mesures')

    // XL bust is 106 cm with no ease, so the finished garment field follows.
    await waitFor(() =>
      expect((screen.getByLabelText('Tour de poitrine fini') as HTMLInputElement).value).toBe(
        '106',
      ),
    )
  })

  describe('construction constraints', () => {
    it('rounds the stitch count to the pattern repeat', async () => {
      await openStudioWith('Écharpe', 'accessory')
      await goToStep('Contraintes')

      fireEvent.change(screen.getByLabelText('Répétition du motif'), { target: { value: '6' } })

      await goToStep('Calculs')
      // 25 cm at 2 st/cm is 50 stitches, rounded down to 48 — a multiple of six.
      expect(await screen.findByRole('button', { name: /48/ })).toBeDefined()
    })

    it('applies a minimum stitch count', async () => {
      await openStudioWith('Écharpe', 'accessory')
      await goToStep('Contraintes')

      fireEvent.change(screen.getByLabelText('Minimum de mailles'), { target: { value: '80' } })

      await goToStep('Calculs')
      expect(await screen.findByRole('button', { name: /80/ })).toBeDefined()
    })
  })

  describe('colours', () => {
    it('assigns a palette colour to a row', async () => {
      await openStudioWith('Écharpe', 'accessory')
      await generate()
      await waitFor(() => expect(screen.getByText('Panneau')).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: /Ajouter une couleur/ }))

      const chooser = (await screen.findByLabelText('Couleur du rang 2')) as HTMLSelectElement
      const option = within(chooser).getByRole('option', { name: 'Couleur 1' }) as HTMLOptionElement
      fireEvent.change(chooser, { target: { value: option.value } })

      await waitFor(() => expect(chooser.value).toBe(option.value))
    })
  })
})
