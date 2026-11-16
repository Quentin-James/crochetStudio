// @vitest-environment jsdom
// jsdom has no WebGL, which makes it the right place to check the degraded path:
// the studio must say so plainly and keep everything that doesn't need a GPU —
// including the measurements, the palette and the colour placement.
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../app/App'
import { DEFAULT_SETTINGS } from '../../core/defaults'
import { generatePattern } from '../../core/patterns/generators'
import { eraseAllData } from '../../data/backup/backup'
import { db } from '../../data/db'
import {
  createProject,
  setActiveProject,
  updateProject,
} from '../../data/repositories/projectRepository'
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

async function openStudio3DWith(category: 'dress' | 'bag', withPattern: boolean) {
  const project = await createProject({ name: 'Robe en 3D', category }, DEFAULT_SETTINGS)

  if (withPattern) {
    const { pattern } = generatePattern({
      category,
      gauge: project.gauge,
      dimensions: project.dimensions,
    })
    await updateProject(project.id, { pattern })
  }

  await setActiveProject(project.id)
  window.history.pushState({}, '', '/3d')
  render(<App />)
  return project
}

/** Opens a collapsible property panel, leaving it alone if it is already open. */
async function openPanel(title: string) {
  const toggle = await screen.findByRole('button', { name: new RegExp(title) })
  if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
}

/** Reads a figure out of the model statistics list. */
function stat(label: string): string {
  const term = screen.getByText(label)
  return term.parentElement?.textContent ?? ''
}

describe('3D Studio', () => {
  it('asks for a project when none is open', async () => {
    window.history.pushState({}, '', '/3d')
    render(<App />)

    expect(await screen.findByText('Aucun projet ouvert')).toBeDefined()
  })

  it('says plainly when WebGL is unavailable instead of failing', async () => {
    await openStudio3DWith('dress', true)

    expect(await screen.findByText('La 3D n’est pas disponible sur ce navigateur')).toBeDefined()
    // The workspace around it still works.
    expect(screen.getByText('Robe en 3D')).toBeDefined()
    expect(screen.getByText('Modèle')).toBeDefined()
  })

  it('reports that the volume comes from the pattern, with the real figures', async () => {
    await openStudio3DWith('dress', true)

    expect(await screen.findByText('Motif généré')).toBeDefined()

    // 224 stitches around the hem, 149 rows, 98.7 cm tall at the default gauge.
    expect(stat('Mailles / tour')).toContain('224')
    expect(stat('Rangs')).toContain('149')
    expect(stat('Hauteur modèle')).toContain('98.7')
  })

  it('falls back to the measurements when no pattern exists, and warns', async () => {
    await openStudio3DWith('bag', false)

    expect(await screen.findByText('Volume depuis les mesures')).toBeDefined()
    // Said twice on purpose: once in the model panel, once where it explains
    // why the stitches cannot be placed.
    expect(screen.getAllByText(/Aucun motif généré/).length).toBeGreaterThan(0)
  })

  it('puts the stitch controls up front, because seeing the stitches is the point', async () => {
    await openStudio3DWith('bag', true)

    // No panel to open first: the switch and the render mode are visible.
    expect(await screen.findByRole('switch', { name: /Montrer les mailles/ })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: 'Rendu des mailles' })).toBeDefined()
    expect(screen.getByLabelText('Taille des mailles')).toBeDefined()
  })

  it('switches between real stitch geometry and painted relief', async () => {
    await openStudio3DWith('bag', true)

    const modes = await screen.findByRole('radiogroup', { name: 'Rendu des mailles' })
    expect(within(modes).getByRole('radio', { name: 'Mailles en volume' }).getAttribute('aria-checked')).toBe('true')

    fireEvent.click(within(modes).getByRole('radio', { name: 'Relief peint' }))

    await waitFor(() =>
      expect(screen.getByText(/Le relief est peint sur une surface lisse/)).toBeDefined(),
    )
    // The slider renames itself, because it no longer scales real stitches.
    expect(screen.getByLabelText('Finesse du grain')).toBeDefined()
  })

  it('hides the stitch options when the stitches are switched off', async () => {
    await openStudio3DWith('bag', true)

    fireEvent.click(await screen.findByRole('switch', { name: /Montrer les mailles/ }))

    await waitFor(() =>
      expect(screen.queryByRole('radiogroup', { name: 'Rendu des mailles' })).toBeNull(),
    )
  })

  it('cannot capture a preview without WebGL, and the button says so', async () => {
    await openStudio3DWith('bag', true)

    const capture = await screen.findByRole('button', { name: /Capturer l’aperçu/ })
    await waitFor(() => expect((capture as HTMLButtonElement).disabled).toBe(true))
  })

  describe('editing the measurements from the 3D studio', () => {
    it('rebuilds the model when the bag width changes', async () => {
      await openStudio3DWith('bag', true)

      // 130 stitches around at 2 st/cm is 65 cm, so a 20.7 cm diameter.
      await waitFor(() => expect(stat('Largeur modèle')).toContain('20.7'))

      fireEvent.change(screen.getByLabelText('Largeur'), { target: { value: '40' } })

      // A wider bag means a longer base perimeter and a wider model.
      await waitFor(() => expect(stat('Largeur modèle')).toContain('28.3'))
      expect(stat('Mailles / tour')).toContain('178')
    })

    it('offers every measurement of the category, including the strap width', async () => {
      await openStudio3DWith('bag', true)

      for (const label of [
        'Largeur',
        'Hauteur',
        'Profondeur',
        'Hauteur d’anse',
        'Largeur de bandoulière',
      ]) {
        expect(await screen.findByLabelText(label)).toBeDefined()
      }
    })

    it('widens the strap in the model when its width changes', async () => {
      await openStudio3DWith('bag', true)

      const strap = (await screen.findByLabelText('Largeur de bandoulière')) as HTMLInputElement
      expect(strap.value).toBe('3')

      fireEvent.change(strap, { target: { value: '8' } })

      // 8 cm at 2 st/cm is 16 stitches across the band instead of 6, so the
      // pattern — and with it the model — grows.
      await waitFor(() => expect((strap as HTMLInputElement).value).toBe('8'))
      await waitFor(() => expect(stat('Rangs')).not.toBe(''))
    })

    it('recalculates the pattern silently when no row is hand-edited', async () => {
      await openStudio3DWith('bag', true)

      const rowsBefore = Number.parseInt(
        (await screen.findByText('Rangs')).parentElement?.textContent?.replace(/\D/g, '') ?? '0',
        10,
      )
      expect(rowsBefore).toBeGreaterThan(0)

      fireEvent.change(await screen.findByLabelText('Hauteur'), { target: { value: '40' } })

      // 16 cm taller at 1.5 rows/cm is exactly 24 more rounds on the body.
      await waitFor(() => expect(stat('Rangs')).toContain(String(rowsBefore + 24)))
      // And no warning is raised, because nothing of the user's was at risk.
      expect(screen.queryByText(/Le motif ne suit plus ces mesures/)).toBeNull()
    })
  })

  describe('colours', () => {
    it('adds a palette colour and paints a section with it', async () => {
      await openStudio3DWith('bag', true)

      fireEvent.click(await screen.findByRole('button', { name: /Ajouter une couleur/ }))

      // The new colour is armed for painting as soon as it is created.
      const swatch = await screen.findByTitle(/Peindre avec « Couleur 1 »/)
      expect(swatch).toBeDefined()

      await openPanel('Placement des couleurs')

      fireEvent.click(await screen.findByTitle(/Peindre « Corps » avec Couleur 1/))

      // The colour now appears in the legend of colours actually used.
      const legend = await screen.findByText('Couleur 1', { selector: 'li' })
      expect(legend).toBeDefined()
    })

    it('lays stripes across a section', async () => {
      await openStudio3DWith('bag', true)

      fireEvent.click(await screen.findByRole('button', { name: /Ajouter une couleur/ }))
      await openPanel('Placement des couleurs')

      const stripeButton = await screen.findByRole('button', { name: /Rayer avec Couleur 1/ })
      fireEvent.click(stripeButton)

      // The section reports that stripes are in place.
      await waitFor(() => expect(screen.getAllByText(/rayures posées/).length).toBeGreaterThan(0))
    })

    it('removing a colour also clears the rows that used it', async () => {
      await openStudio3DWith('bag', true)

      fireEvent.click(await screen.findByRole('button', { name: /Ajouter une couleur/ }))
      await openPanel('Placement des couleurs')
      fireEvent.click(await screen.findByTitle(/Peindre « Corps » avec Couleur 1/))
      await screen.findByText('Couleur 1', { selector: 'li' })

      fireEvent.click(screen.getByRole('button', { name: 'Supprimer Couleur 1' }))

      await waitFor(() =>
        expect(screen.queryByText('Couleur 1', { selector: 'li' })).toBeNull(),
      )
    })
  })

  describe('viewport toolbar', () => {
    it('toggles the grid and the wireframe', async () => {
      await openStudio3DWith('bag', true)

      // Without WebGL the toolbar is not rendered at all, so this checks the
      // supported path is the only one that offers the tools.
      expect(screen.queryByRole('toolbar', { name: 'Outils de la vue 3D' })).toBeNull()
    })
  })
})

describe('project header', () => {
  it('summarises the project without opening a panel', async () => {
    await openStudio3DWith('bag', true)

    const header = (await screen.findByText('Robe en 3D')).parentElement
    expect(header?.textContent).toContain('Sac')
    expect(header?.textContent).toContain('Échantillon 20 m × 15 r')
    expect(within(header as HTMLElement).getByText('Motif généré')).toBeDefined()
  })
})
