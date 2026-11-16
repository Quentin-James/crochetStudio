import { useState } from 'react'
import { paletteOf, resolveRowColor, resolveSectionColor } from '../../core/colors'
import { STITCHES, STITCH_ORDER } from '../../core/stitches'
import { globalRowNumber } from '../../core/patterns/rows'
import type {
  Pattern,
  PatternRow,
  PatternSection,
  StitchId,
  YarnSettings,
} from '../../core/types'
import { Button, Icon, Select, Surface } from '../../design/components'
import type { usePatternStudio } from './usePatternStudio'
import './PatternSections.css'

type Studio = ReturnType<typeof usePatternStudio>

interface PatternSectionsProps {
  pattern: Pattern
  yarn: YarnSettings
  completedRows: number
  studio: Studio
}

/** How many rows are shown before the "show more" control appears. */
const PAGE_SIZE = 40

export function PatternSections({
  pattern,
  yarn,
  completedRows,
  studio,
}: PatternSectionsProps) {
  return (
    <div className="cs-rows">
      {pattern.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          pattern={pattern}
          yarn={yarn}
          completedRows={completedRows}
          studio={studio}
        />
      ))}
    </div>
  )
}

interface SectionCardProps {
  section: PatternSection
  pattern: Pattern
  yarn: YarnSettings
  completedRows: number
  studio: Studio
}

function SectionCard({ section, pattern, yarn, completedRows, studio }: SectionCardProps) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [editingName, setEditingName] = useState(false)

  const shown = section.rows.slice(0, visible)
  const remaining = section.rows.length - shown.length

  return (
    <Surface padding="md" className="cs-section">
      <header className="cs-section__head">
        <div className="cs-section__title">
          {editingName ? (
            <input
              className="cs-section__name-input"
              value={section.name}
              autoFocus
              aria-label="Nom de la section"
              onChange={(event) => studio.renameSection(section.id, event.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') setEditingName(false)
              }}
            />
          ) : (
            <button
              type="button"
              className="cs-section__name"
              onClick={() => setEditingName(true)}
              title="Renommer la section"
            >
              {section.name}
            </button>
          )}

          <span className="cs-section__meta">
            {section.direction === 'inTheRound' ? 'En rond' : 'À plat'} ·{' '}
            {section.rows.length} rang{section.rows.length === 1 ? '' : 's'}
            {section.generatedBy === null && ' · ajoutée par vous'}
          </span>
        </div>

        <div className="cs-section__tools">
          <ColorChooser
            value={section.colorId}
            yarn={yarn}
            resolved={resolveSectionColor(yarn, section)}
            label={`Couleur de la section ${section.name}`}
            onChange={(colorId) => studio.setSectionColor(section.id, colorId)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            iconOnly
            onClick={() => studio.deleteSection(section.id)}
          >
            Supprimer la section
          </Button>
        </div>
      </header>

      {section.notes !== '' && <p className="cs-section__notes">{section.notes}</p>}

      {section.rows.length === 0 ? (
        <p className="cs-section__empty">
          Cette section est vide. Ajoutez un premier rang pour commencer.
        </p>
      ) : (
        <ul className="cs-rows__list">
          {shown.map((row) => (
            <RowItem
              key={row.id}
              row={row}
              section={section}
              yarn={yarn}
              globalNumber={globalRowNumber(pattern, section.id, row.index)}
              completedRows={completedRows}
              studio={studio}
            />
          ))}
        </ul>
      )}

      <footer className="cs-section__foot">
        {remaining > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setVisible(visible + PAGE_SIZE)}>
            Afficher {Math.min(remaining, PAGE_SIZE)} rang(s) de plus ({remaining} restants)
          </Button>
        )}
        <Button size="sm" icon="plus" onClick={() => studio.addRowAfter(section.id, null)}>
          Ajouter un rang
        </Button>
      </footer>
    </Surface>
  )
}

interface RowItemProps {
  row: PatternRow
  section: PatternSection
  yarn: YarnSettings
  globalNumber: number
  completedRows: number
  studio: Studio
}

function RowItem({ row, section, yarn, globalNumber, completedRows, studio }: RowItemProps) {
  const done = globalNumber <= completedRows
  const sectionId = section.id

  return (
    <li className={`cs-row${row.locked ? ' cs-row--locked' : ''}${done ? ' cs-row--done' : ''}`}>
      <label className="cs-row__done">
        <input
          type="checkbox"
          checked={done}
          aria-label={`Rang ${globalNumber} crocheté`}
          // Ticking a row means "I have worked up to here".
          onChange={(event) =>
            studio.setCompletedRows(event.target.checked ? globalNumber : globalNumber - 1)
          }
        />
      </label>

      <span className="cs-row__index">R{row.index}</span>

      <input
        className="cs-row__count"
        type="text"
        inputMode="numeric"
        value={row.stitchCount}
        aria-label={`Mailles au rang ${row.index}`}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value.replace(/\D/g, ''), 10)
          if (Number.isFinite(parsed)) studio.setRowStitchCount(sectionId, row.id, parsed)
        }}
      />

      <div className="cs-row__stitch">
        <Select<StitchId>
          value={row.stitch}
          options={STITCH_ORDER.map((stitch) => ({
            value: stitch,
            label: STITCHES[stitch].abbreviation,
          }))}
          onValueChange={(value) => studio.setRowStitch(sectionId, row.id, value)}
        />
      </div>

      <span className="cs-row__instruction">
        {row.instruction}
        {row.shaping.delta !== 0 && (
          <span
            className={`cs-row__shaping cs-row__shaping--${
              row.shaping.delta > 0 ? 'increase' : 'decrease'
            }`}
          >
            {row.shaping.delta > 0 ? `+${row.shaping.delta}` : row.shaping.delta}
          </span>
        )}
      </span>

      <ColorChooser
        value={row.colorId}
        yarn={yarn}
        resolved={resolveRowColor(yarn, section, row)}
        label={`Couleur du rang ${row.index}`}
        compact
        onChange={(colorId) => studio.setRowColor(sectionId, row.id, colorId)}
      />

      <input
        className="cs-row__note"
        type="text"
        value={row.note}
        placeholder="note"
        aria-label={`Note du rang ${row.index}`}
        onChange={(event) => studio.setRowNote(sectionId, row.id, event.target.value)}
      />

      <button
        type="button"
        className="cs-row__action"
        aria-label={
          row.locked
            ? `Rendre le rang ${row.index} au calcul automatique`
            : `Fixer le rang ${row.index} à la main`
        }
        title={
          row.locked
            ? 'Modifié à la main — cliquez pour le laisser se recalculer'
            : 'Calculé automatiquement — cliquez pour le fixer'
        }
        onClick={() => studio.toggleRowLock(sectionId, row.id)}
      >
        <Icon name={row.locked ? 'lock' : 'unlock'} size={15} />
      </button>

      <button
        type="button"
        className="cs-row__action cs-row__action--danger"
        aria-label={`Supprimer le rang ${row.index}`}
        title="Supprimer ce rang"
        onClick={() => studio.deleteRow(sectionId, row.id)}
      >
        <Icon name="trash" size={15} />
      </button>
    </li>
  )
}

interface ColorChooserProps {
  value: string | null
  yarn: YarnSettings
  /** The colour actually in force, which may be inherited. */
  resolved: string
  label: string
  compact?: boolean
  onChange: (colorId: string | null) => void
}

/**
 * Picks a palette colour for a row or a section.
 *
 * A native select rather than a popover: it is one tap on an iPad, reachable by
 * keyboard, and the swatch beside it shows the colour actually in force —
 * including when it is inherited from the section or the main yarn.
 */
function ColorChooser({
  value,
  yarn,
  resolved,
  label,
  compact = false,
  onChange,
}: ColorChooserProps) {
  const palette = paletteOf(yarn)

  return (
    <span className={`cs-color-chooser${compact ? ' cs-color-chooser--compact' : ''}`}>
      <span className="cs-color-chooser__swatch" style={{ background: resolved }} aria-hidden="true" />
      <select
        className="cs-color-chooser__select"
        value={value ?? ''}
        aria-label={label}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">{compact ? '—' : 'Couleur par défaut'}</option>
        {palette.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>
    </span>
  )
}
