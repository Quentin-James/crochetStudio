// @vitest-environment jsdom
// Geometry and materials can be built without a GPU, which is how the colour
// pipeline gets a regression test: a double sRGB conversion once turned every
// model nearly black, and nothing but a numeric check would have caught it.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THREE, DEFAULT_YARN } from '../../core/defaults'
import type { ModelSpec } from './silhouette'
import { buildModel } from './buildMesh'

const PINK = '#D9B6B0'
const DARK = '#44382F'

function spec(overrides: Partial<ModelSpec> = {}): ModelSpec {
  return {
    kind: 'revolution',
    rings: [
      { y: 0, radius: 10, stitches: 120, color: PINK, stitchColors: null },
      { y: 20, radius: 10, stitches: 120, color: PINK, stitchColors: null },
    ],
    panel: null,
    strap: null,
    depthRatio: 1,
    closedBase: false,
    stitchesAround: 120,
    rowCount: 30,
    totalHeightCm: 20,
    maxRadiusCm: 10,
    source: 'pattern',
    warnings: [],
    ...overrides,
  }
}

/** Reads the first vertex colour out of the body mesh. */
function firstVertexColor(model: ReturnType<typeof buildModel>): THREE.Color {
  const mesh = model.group.children[0] as THREE.Mesh
  const attribute = mesh.geometry.getAttribute('color')
  return new THREE.Color(attribute.getX(0), attribute.getY(0), attribute.getZ(0))
}

describe('vertex colours', () => {
  it('stores the colour the user chose, not a darkened copy', () => {
    const model = buildModel(spec(), DEFAULT_YARN, DEFAULT_THREE)
    const expected = new THREE.Color(PINK)

    const actual = firstVertexColor(model)
    expect(actual.r).toBeCloseTo(expected.r, 6)
    expect(actual.g).toBeCloseTo(expected.g, 6)
    expect(actual.b).toBeCloseTo(expected.b, 6)

    model.dispose()
  })

  it('keeps a dark colour dark rather than black', () => {
    const model = buildModel(
      spec({
        rings: [
          { y: 0, radius: 10, stitches: 120, color: DARK, stitchColors: null },
          { y: 20, radius: 10, stitches: 120, color: DARK, stitchColors: null },
        ],
      }),
      DEFAULT_YARN,
      DEFAULT_THREE,
    )

    const expected = new THREE.Color(DARK)
    const actual = firstVertexColor(model)

    expect(actual.r).toBeCloseTo(expected.r, 6)
    // The bug halved this value more than four times over; guard the magnitude.
    expect(actual.r).toBeGreaterThan(0.04)

    model.dispose()
  })

  it('gives every yarn-material mesh a colour attribute, since that material reads one', () => {
    const model = buildModel(
      spec({
        closedBase: true,
        strap: { lengthCm: 40, widthCm: 4, color: PINK },
        panel: { widthCm: 20, heightCm: 30, color: DARK },
      }),
      DEFAULT_YARN,
      DEFAULT_THREE,
    )

    // A mesh without vertex colours renders black when the material expects
    // them — which is exactly the bug this file exists for. The instanced stitch
    // mesh is the one exception: it carries a colour per instance instead.
    for (const child of model.group.children) {
      const mesh = child as THREE.Mesh

      if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
        expect((mesh as THREE.InstancedMesh).instanceColor).toBeTruthy()
        expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(false)
        continue
      }

      expect(mesh.material).toBe(model.material)
      expect(mesh.geometry.getAttribute('color')).toBeDefined()
    }

    model.dispose()
  })

  it('stripes the body when consecutive rings differ', () => {
    const model = buildModel(
      spec({
        rings: [
          { y: 0, radius: 10, stitches: 120, color: PINK, stitchColors: null },
          { y: 10, radius: 10, stitches: 120, color: DARK, stitchColors: null },
          { y: 20, radius: 10, stitches: 120, color: PINK, stitchColors: null },
        ],
      }),
      DEFAULT_YARN,
      DEFAULT_THREE,
    )

    const mesh = model.group.children[0] as THREE.Mesh
    const attribute = mesh.geometry.getAttribute('color')
    const columns = attribute.count / 3

    expect(attribute.getX(0)).toBeCloseTo(new THREE.Color(PINK).r, 6)
    expect(attribute.getX(columns)).toBeCloseTo(new THREE.Color(DARK).r, 6)

    model.dispose()
  })
})

