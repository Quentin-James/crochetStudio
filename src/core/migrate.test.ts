import { describe, expect, it } from 'vitest'
import { PROJECT_SCHEMA_VERSION } from './defaults'
import { migrateProject } from './migrate'
import { buildProject } from './projectFactory'
import type { Project } from './types'

/**
 * A project exactly as version 1 of the app stored it: no palette, no colour
 * references, none of the viewport options added since. Opening it must work.
 */
function v1Document(): Project {
  const current = buildProject({ name: 'Ancien projet', category: 'bag' }, { now: 1, id: 'old' })

  const { palette: _palette, ...yarnWithoutPalette } = current.yarn
  const { minStitches: _min, shapingStep: _step, ...patternWithoutConstraints } = current.pattern
  const { showGrid: _grid, wireframe: _wire, showShadow: _shadow, lightIntensity: _light, quality: _quality, stitchScale: _scale, ...threeV1 } = current.three

  return {
    ...current,
    schemaVersion: 1,
    yarn: yarnWithoutPalette,
    three: threeV1,
    pattern: {
      ...patternWithoutConstraints,
      sections: [
        {
          id: 's1',
          name: 'Corps',
          direction: 'inTheRound',
          notes: '',
          generatedBy: 'bag/body',
          rows: [
            {
              id: 'r1',
              index: 1,
              stitch: 'dc',
              stitchCount: 120,
              shaping: { kind: 'even', delta: 0 },
              instruction: '120 br (120 m)',
              note: 'ma note',
              locked: true,
            },
          ],
        },
      ],
    },
  } as unknown as Project
}

describe('migrating a version 1 project', () => {
  const migrated = migrateProject(v1Document())

  it('opens without throwing and is stamped with the current version', () => {
    expect(migrated.schemaVersion).toBe(PROJECT_SCHEMA_VERSION)
  })

  it('gains an empty palette rather than an undefined one', () => {
    expect(migrated.yarn.palette).toEqual([])
  })

  it('gives every section and row a null colour reference', () => {
    const section = migrated.pattern.sections[0]
    expect(section?.colorId).toBeNull()
    expect(section?.rows[0]?.colorId).toBeNull()
  })

  it('keeps everything the user had written', () => {
    const row = migrated.pattern.sections[0]?.rows[0]
    expect(row?.stitchCount).toBe(120)
    expect(row?.note).toBe('ma note')
    expect(row?.locked).toBe(true)
  })

  it('fills the new construction constraints with their defaults', () => {
    expect(migrated.pattern.minStitches).toBe(0)
    expect(migrated.pattern.shapingStep).toBe(6)
  })

  it('fills the new viewport options with their defaults', () => {
    expect(migrated.three.showGrid).toBe(false)
    expect(migrated.three.quality).toBe('high')
    expect(migrated.three.lightIntensity).toBe(1)
    // And keeps the camera the user left it at.
    expect(migrated.three.cameraDistance).toBe(90)
  })
})

describe('migrating a current project', () => {
  it('returns it untouched', () => {
    const current = buildProject({ name: 'À jour', category: 'dress' }, { now: 2, id: 'new' })
    expect(migrateProject(current)).toBe(current)
  })
})
