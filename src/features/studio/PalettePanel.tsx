import { useState } from 'react'
import {
  COLOR_SUGGESTIONS,
  addColor,
  clearColorReferences,
  paletteOf,
  removeColor,
  updateColor,
} from '../../core/colors'
import type { Id, Project } from '../../core/types'
import { Button, Icon } from '../../design/components'
import type { ProjectPatch } from '../../data/repositories/projectRepository'
import './PalettePanel.css'

interface PalettePanelProps {
  project: Project
  update: (patch: ProjectPatch) => void
  /** The colour currently armed for painting, if the caller tracks one. */
  selectedId?: Id | null
  onSelect?: (id: Id | null) => void
}

/**
 * The project's colour palette.
 *
 * The main colour is always present; any number of extra colours can be added,
 * renamed and recoloured. Deleting one also clears every section and row that
 * referenced it, so the pattern never points at a colour that is gone.
 */
export function PalettePanel({ project, update, selectedId, onSelect }: PalettePanelProps) {
  const palette = paletteOf(project.yarn)
  const [editing, setEditing] = useState<Id | null>(null)

  const addFromSuggestion = () => {
    const used = new Set([project.yarn.color.toLowerCase(), ...palette.map((c) => c.color.toLowerCase())])
    const next = COLOR_SUGGESTIONS.find((hex) => !used.has(hex.toLowerCase())) ?? '#D9B6B0'
    const { yarn, id } = addColor(project.yarn, next)
    update({ yarn })
    onSelect?.(id)
    setEditing(id)
  }

  const remove = (id: Id) => {
    update({
      yarn: removeColor(project.yarn, id),
      // References must go with it, or rows point at nothing.
      pattern: clearColorReferences(project.pattern, id),
    })
    if (selectedId === id) onSelect?.(null)
  }

  return (
    <div className="cs-palette">
      <ul className="cs-palette__list">
        <li>
          <div
            className={`cs-palette__entry${
              selectedId === null && onSelect ? ' cs-palette__entry--selected' : ''
            }`}
          >
            <button
              type="button"
              className="cs-palette__swatch-button"
              onClick={() => onSelect?.(null)}
              title={onSelect ? 'Peindre avec la couleur principale' : 'Couleur principale'}
            >
              <span
                className="cs-palette__swatch"
                style={{ background: project.yarn.color }}
                aria-hidden="true"
              />
            </button>

            <div className="cs-palette__fields">
              <span className="cs-palette__name">Couleur principale</span>
              <input
                type="color"
                className="cs-palette__picker"
                value={project.yarn.color}
                aria-label="Couleur principale"
                onChange={(event) =>
                  update({ yarn: { ...project.yarn, color: event.target.value } })
                }
              />
            </div>
          </div>
        </li>

        {palette.map((entry) => (
          <li key={entry.id}>
            <div
              className={`cs-palette__entry${
                selectedId === entry.id ? ' cs-palette__entry--selected' : ''
              }`}
            >
              <button
                type="button"
                className="cs-palette__swatch-button"
                onClick={() => onSelect?.(entry.id)}
                title={onSelect ? `Peindre avec « ${entry.label} »` : entry.label}
              >
                <span
                  className="cs-palette__swatch"
                  style={{ background: entry.color }}
                  aria-hidden="true"
                />
              </button>

              <div className="cs-palette__fields">
                {editing === entry.id ? (
                  <input
                    className="cs-palette__name-input"
                    value={entry.label}
                    autoFocus
                    aria-label="Nom de la couleur"
                    onChange={(event) =>
                      update({ yarn: updateColor(project.yarn, entry.id, { label: event.target.value }) })
                    }
                    onBlur={() => setEditing(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="cs-palette__name cs-palette__name--button"
                    onClick={() => setEditing(entry.id)}
                    title="Renommer"
                  >
                    {entry.label}
                  </button>
                )}

                <input
                  type="color"
                  className="cs-palette__picker"
                  value={entry.color}
                  aria-label={`Teinte de ${entry.label}`}
                  onChange={(event) =>
                    update({ yarn: updateColor(project.yarn, entry.id, { color: event.target.value }) })
                  }
                />
              </div>

              <button
                type="button"
                className="cs-palette__remove"
                aria-label={`Supprimer ${entry.label}`}
                title="Supprimer cette couleur"
                onClick={() => remove(entry.id)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Button size="sm" icon="plus" onClick={addFromSuggestion}>
        Ajouter une couleur
      </Button>
    </div>
  )
}
