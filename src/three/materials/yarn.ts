import * as THREE from 'three'
import type { ThreeConfig, YarnSettings } from '../../core/types'

/**
 * Yarn appearance.
 *
 * The stitch structure is a procedurally drawn texture rather than imported art:
 * a tile of V-shaped stitches used as a bump and roughness map. Its repeat is set
 * from the project's real stitch and row counts, so the visible stitch density
 * matches the pattern — a 184-stitch round shows 184 stitches around.
 *
 * Why a texture rather than one mesh per stitch: a dress of 184 stitches × 150
 * rows is 27 600 stitches, and that much geometry is not something an iPad GPU
 * should be asked to orbit smoothly. The geometry stays a surface; the relief is
 * shaded. `ModelSpec` already carries the per-round stitch counts, so a future
 * instanced-stitch renderer can be added without changing anything upstream.
 */

/** Stitches represented across one texture tile, in each direction. */
const STITCHES_PER_TILE = 4
const TILE_PIXELS = 256

let cachedTile: HTMLCanvasElement | null = null

/**
 * Draws one tile of crochet fabric in greyscale.
 *
 * Mid-grey is the neutral height, lighter is raised (the two legs of the stitch),
 * darker is the hole between posts. Cached: the drawing never changes, only how
 * often it repeats.
 */
function stitchTile(): HTMLCanvasElement {
  if (cachedTile) return cachedTile

  const canvas = document.createElement('canvas')
  canvas.width = TILE_PIXELS
  canvas.height = TILE_PIXELS

  const context = canvas.getContext('2d')
  if (!context) return canvas

  const cell = TILE_PIXELS / STITCHES_PER_TILE

  context.fillStyle = '#808080'
  context.fillRect(0, 0, TILE_PIXELS, TILE_PIXELS)

  for (let row = 0; row < STITCHES_PER_TILE; row += 1) {
    for (let column = 0; column < STITCHES_PER_TILE; column += 1) {
      // Offset every other row by half a stitch, as crochet rows actually sit.
      const x = column * cell + (row % 2 === 0 ? 0 : cell / 2)
      const y = row * cell

      // The hollow at the base of the stitch.
      context.fillStyle = '#6b6b6b'
      context.beginPath()
      context.ellipse(x + cell / 2, y + cell * 0.82, cell * 0.22, cell * 0.12, 0, 0, Math.PI * 2)
      context.fill()

      // The two raised legs, drawn as a V.
      context.strokeStyle = '#c9c9c9'
      context.lineWidth = cell * 0.17
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(x + cell * 0.22, y + cell * 0.18)
      context.lineTo(x + cell * 0.5, y + cell * 0.72)
      context.lineTo(x + cell * 0.78, y + cell * 0.18)
      context.stroke()

      // A highlight along the top loop.
      context.strokeStyle = '#e4e4e4'
      context.lineWidth = cell * 0.09
      context.beginPath()
      context.moveTo(x + cell * 0.18, y + cell * 0.14)
      context.lineTo(x + cell * 0.82, y + cell * 0.14)
      context.stroke()
    }
  }

  cachedTile = canvas
  return canvas
}

export interface YarnMaterialInput {
  yarn: YarnSettings
  three: ThreeConfig
  /** Stitches around the widest round; 0 when unknown. */
  stitchesAround: number
  /** Rows up the piece; 0 when unknown. */
  rowCount: number
}

/** A material whose stitch grain matches the project's own gauge. */
export function createYarnMaterial(input: YarnMaterialInput): THREE.MeshStandardMaterial {
  const texture = new THREE.CanvasTexture(stitchTile())
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.NoColorSpace

  const material = new THREE.MeshStandardMaterial({
    // White base: the colour comes from the geometry's vertex colours, which is
    // what lets one mesh carry stripes and colour blocks.
    color: new THREE.Color('#ffffff'),
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    bumpMap: texture,
    roughnessMap: texture,
    side: THREE.DoubleSide,
  })

  applyYarn(material, input)
  return material
}

/** Updates an existing material in place — colour and thickness are live controls. */
export function applyYarn(
  material: THREE.MeshStandardMaterial,
  input: YarnMaterialInput,
): void {
  const { yarn, three, stitchesAround, rowCount } = input

  // Colour lives in the geometry (see `paintGeometry`), so a colour change
  // rebuilds the mesh rather than touching the material here.
  const texture = material.bumpMap
  if (texture) {
    // The grain density is the project's own stitch and row counts; `stitchScale`
    // only lets the user read it finer or coarser on screen.
    const scale = three.stitchScale > 0 ? three.stitchScale : 1
    const across = (stitchesAround > 0 ? stitchesAround / STITCHES_PER_TILE : 24) * scale
    const up = (rowCount > 0 ? rowCount / STITCHES_PER_TILE : 24) * scale
    texture.repeat.set(Math.max(1, across), Math.max(1, up))
    texture.needsUpdate = true
  }

  // A thicker strand reads as deeper relief.
  const relief = (yarn.strandDiameterMm / 2) * three.yarnThicknessScale
  material.bumpScale = three.showStitchDetail ? clamp(relief * 0.5, 0.05, 1.6) : 0
  material.roughness = three.showStitchDetail ? 0.92 : 0.8
  material.needsUpdate = true
}

/** Background tones, taken from the studio palette. */
export const BACKGROUNDS: Record<ThreeConfig['backgroundTone'], number> = {
  ivory: 0xf8f4ee,
  cream: 0xf1e8dc,
  brown: 0x44382f,
}

/** Frees the per-material texture. */
export function disposeYarnMaterial(material: THREE.MeshStandardMaterial): void {
  material.bumpMap?.dispose()
  material.dispose()
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
