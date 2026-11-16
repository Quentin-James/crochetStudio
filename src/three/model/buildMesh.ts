import * as THREE from 'three'
import type { ThreeConfig, YarnSettings } from '../../core/types'
import { applyYarn, createYarnMaterial, disposeYarnMaterial } from '../materials/yarn'
import type { ModelSpec, Ring } from './silhouette'
import { buildStitchField } from './stitches'

/**
 * Turns a `ModelSpec` into Three.js geometry.
 *
 * One world unit is one centimetre, so the camera distances and the measurements
 * the user types are the same numbers.
 */

/** Segments around the body. Enough to look round; cheap enough for an iPad. */
const RADIAL_SEGMENTS = 72

/** Roughly how thick a crocheted band is, in centimetres. */
const FABRIC_THICKNESS_CM = 0.8

export interface BuiltModel {
  group: THREE.Group
  material: THREE.MeshStandardMaterial
  /** Triangles in the model, reported honestly in the UI. */
  triangleCount: number
  /** Stitches actually drawn as geometry, and whether the field was thinned. */
  stitches: { drawn: number; requested: number; capped: boolean }
  update: (yarn: YarnSettings, three: ThreeConfig) => void
  setWireframe: (on: boolean) => void
  dispose: () => void
}

export function buildModel(
  spec: ModelSpec,
  yarn: YarnSettings,
  three: ThreeConfig,
): BuiltModel {
  const material = createYarnMaterial({
    yarn,
    three,
    stitchesAround: spec.stitchesAround,
    rowCount: spec.rowCount,
  })

  const group = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const extraMaterials: THREE.Material[] = []
  let stitches = { drawn: 0, requested: 0, capped: false }

  if (spec.kind === 'revolution' && spec.rings.length >= 2) {
    const body = revolutionGeometry(spec.rings, spec.depthRatio)
    geometries.push(body)
    group.add(new THREE.Mesh(body, material))

    if (three.stitchRender === 'geometry' && three.showStitchDetail) {
      const field = buildStitchField(spec, three.yarnThicknessScale)

      if (field && field.count > 0) {
        // One instanced mesh for every stitch: thousands of them, one draw call.
        const stitchMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.85,
          metalness: 0,
        })
        const mesh = new THREE.InstancedMesh(field.geometry, stitchMaterial, field.count)

        for (const [index, matrix] of field.matrices.entries()) {
          mesh.setMatrixAt(index, matrix)
          mesh.setColorAt(index, field.colors[index] as THREE.Color)
        }
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

        group.add(mesh)
        geometries.push(field.geometry)
        extraMaterials.push(stitchMaterial)
        stitches = { drawn: field.count, requested: field.requested, capped: field.capped }
      }
    }

    if (spec.closedBase) {
      const base = baseGeometry(spec.rings, spec.depthRatio)
      if (base) {
        geometries.push(base)
        group.add(new THREE.Mesh(base, material))
      }
    }
  }

  if (spec.panel) {
    const panel = panelGeometry(spec.panel.widthCm, spec.panel.heightCm)
    paintGeometry(panel, spec.panel.color)
    geometries.push(panel)
    const mesh = new THREE.Mesh(panel, material)
    // A standalone panel hangs in place of a body; next to one it sits beside it.
    mesh.position.y = spec.kind === 'panel' ? spec.panel.heightCm / 2 : spec.totalHeightCm / 2
    mesh.position.x = spec.kind === 'panel' ? 0 : spec.maxRadiusCm * 2.2
    group.add(mesh)
  }

  if (spec.strap && spec.rings.length >= 2) {
    const strap = strapGeometry(spec)
    paintGeometry(strap, spec.strap.color)
    geometries.push(strap)
    group.add(new THREE.Mesh(strap, material))
  }

  // Centre the model vertically so it orbits around its middle.
  const height = spec.kind === 'panel' ? (spec.panel?.heightCm ?? 0) : spec.totalHeightCm
  group.position.y = -height / 2

  const triangleCount = geometries.reduce((total, geometry) => {
    const index = geometry.getIndex()
    const positions = geometry.getAttribute('position')
    return total + (index ? index.count / 3 : positions.count / 3)
  }, 0)

  return {
    group,
    material,
    triangleCount: Math.round(triangleCount),
    stitches,
    update: (nextYarn, nextThree) =>
      applyYarn(material, {
        yarn: nextYarn,
        three: nextThree,
        stitchesAround: spec.stitchesAround,
        rowCount: spec.rowCount,
      }),
    setWireframe: (on) => {
      material.wireframe = on
      material.needsUpdate = true
    },
    dispose: () => {
      for (const geometry of geometries) geometry.dispose()
      for (const extra of extraMaterials) extra.dispose()
      disposeYarnMaterial(material)
    },
  }
}

/**
 * A surface of revolution through the rings.
 *
 * The seam column is duplicated so the texture meets itself instead of wrapping
 * the whole way back, and `v` follows real height rather than ring index, so
 * short edging rounds do not stretch the stitch grain.
 */
function revolutionGeometry(rings: readonly Ring[], depthRatio: number): THREE.BufferGeometry {
  const sorted = [...rings].sort((a, b) => a.y - b.y)
  const columns = RADIAL_SEGMENTS + 1
  const totalHeight = Math.max(1e-6, (sorted.at(-1)?.y ?? 0) - (sorted[0]?.y ?? 0))

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const colour = new THREE.Color()

  for (const ring of sorted) {
    // One colour per ring: a row worked in another colour shows as a stripe.
    //
    // `Color.set` already converts the hex from sRGB into the renderer's working
    // space (THREE.ColorManagement is on by default). Converting again here is
    // what turned every model nearly black — a dark brown came out at a twentieth
    // of its brightness.
    colour.set(ring.color)

    for (let column = 0; column < columns; column += 1) {
      const angle = (column / RADIAL_SEGMENTS) * Math.PI * 2
      positions.push(
        Math.cos(angle) * ring.radius,
        ring.y,
        Math.sin(angle) * ring.radius * depthRatio,
      )
      uvs.push(column / RADIAL_SEGMENTS, (ring.y - (sorted[0]?.y ?? 0)) / totalHeight)
      colors.push(colour.r, colour.g, colour.b)
    }
  }

  const indices: number[] = []
  for (let row = 0; row < sorted.length - 1; row += 1) {
    for (let column = 0; column < RADIAL_SEGMENTS; column += 1) {
      const a = row * columns + column
      const b = a + 1
      const c = a + columns
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Gives a helper-built geometry a single, uniform vertex colour. */
function paintGeometry(geometry: THREE.BufferGeometry, hex: string): void {
  const count = geometry.getAttribute('position').count
  // Already in the working colour space — see the note in revolutionGeometry.
  const colour = new THREE.Color(hex)
  const colors = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = colour.r
    colors[index * 3 + 1] = colour.g
    colors[index * 3 + 2] = colour.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/** A slightly domed disc closing the bottom of a bag. */
function baseGeometry(rings: readonly Ring[], depthRatio: number): THREE.BufferGeometry | null {
  const lowest = [...rings].sort((a, b) => a.y - b.y)[0]
  if (!lowest || lowest.radius <= 0) return null

  const geometry = new THREE.CircleGeometry(lowest.radius, RADIAL_SEGMENTS)
  geometry.rotateX(-Math.PI / 2)
  geometry.scale(1, 1, depthRatio)
  geometry.translate(0, lowest.y, 0)
  paintGeometry(geometry, lowest.color)
  return geometry
}

/**
 * A hanging panel with a gentle curl.
 *
 * Crochet fabric does not hang perfectly flat, and a flat plane reads as
 * cardboard, so the surface is bowed slightly in both directions.
 */
function panelGeometry(widthCm: number, heightCm: number): THREE.BufferGeometry {
  const columns = 24
  const rows = Math.max(8, Math.min(48, Math.round(heightCm / 2)))
  const geometry = new THREE.PlaneGeometry(widthCm, heightCm, columns, rows)

  const position = geometry.getAttribute('position')
  const curl = Math.min(widthCm * 0.09, 3)

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const across = (x / widthCm) * Math.PI
    const down = (y / heightCm + 0.5) * Math.PI
    position.setZ(index, Math.cos(across) * curl + Math.sin(down) * curl * 0.25)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** A flattened tube arcing over the opening, its rise driven by the strap length. */
function strapGeometry(spec: ModelSpec): THREE.BufferGeometry {
  const strap = spec.strap
  if (!strap) throw new Error('strapGeometry called without a strap')

  const topY = spec.totalHeightCm
  const anchorX = spec.maxRadiusCm * 0.8
  // Half the strap length becomes the drop; the arc rises by that much.
  const rise = Math.max(2, strap.lengthCm / 2 - 1)

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-anchorX, topY - 1, 0),
    new THREE.Vector3(-anchorX * 0.75, topY + rise * 0.65, 0),
    new THREE.Vector3(0, topY + rise, 0),
    new THREE.Vector3(anchorX * 0.75, topY + rise * 0.65, 0),
    new THREE.Vector3(anchorX, topY - 1, 0),
  ])

  const width = Math.max(0.8, strap.widthCm)
  const geometry = new THREE.TubeGeometry(curve, 64, width / 2, 12, false)

  // Flatten the tube into a band. The thickness stays that of the fabric — about
  // 8 mm — instead of growing with the width, so a wide strap reads as a strap
  // and not as a bolster.
  geometry.scale(1, 1, Math.min(0.5, FABRIC_THICKNESS_CM / width))
  return geometry
}
