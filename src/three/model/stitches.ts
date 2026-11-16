import * as THREE from 'three'
import type { ModelSpec, Ring } from './silhouette'

/**
 * Real stitches.
 *
 * Instead of shading a stitch pattern onto a smooth surface, this places one
 * small mesh per stitch on the fabric: you can see them, count them, and each
 * one can take its own colour — which is what makes colourwork visible on the
 * model rather than only in the chart.
 *
 * Everything is one `InstancedMesh`, so 20 000 stitches are still a single draw
 * call. The cost is vertices, not draw calls, which is why there is a cap.
 */

/**
 * Above this many stitches the studio falls back to the shaded texture and says
 * so. 40 000 stitches at 30 triangles each is already 1.2 million triangles —
 * fine on a desktop, the edge of reasonable on an iPad.
 */
export const STITCH_INSTANCE_LIMIT = 40_000

export interface StitchField {
  geometry: THREE.BufferGeometry
  /** One matrix per stitch, in model space. */
  matrices: THREE.Matrix4[]
  colors: THREE.Color[]
  /** Stitches actually placed. */
  count: number
  /** Stitches the pattern has, which may be more than were placed. */
  requested: number
  capped: boolean
}

/**
 * The shape of one stitch: a flattened arc, like the top loop of a crochet
 * stitch seen from the front. Deliberately low-poly — 30 triangles — because it
 * is about to be repeated thousands of times.
 */
function stitchGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.TorusGeometry(0.42, 0.17, 3, 6, Math.PI * 1.35)
  // Open end downwards, so the arc reads as a loop sitting on the row below.
  geometry.rotateZ(-Math.PI * 0.18)
  return geometry
}

/**
 * Builds the instance transforms for a body of revolution.
 *
 * Each stitch sits between two rings, at its own angle around the body, turned
 * to face outwards and scaled to the size that round's stitches actually are.
 */
export function buildStitchField(spec: ModelSpec, scale: number): StitchField | null {
  if (spec.kind !== 'revolution' || spec.rings.length < 2) return null

  const rings = [...spec.rings].sort((a, b) => a.y - b.y)

  const requested = rings.slice(1).reduce((total, ring) => total + ring.stitches, 0)
  if (requested === 0) return null

  // Thin the field evenly rather than cutting it off part-way: a half-covered
  // model would be a lie about where the stitches are.
  const stride = requested > STITCH_INSTANCE_LIMIT ? Math.ceil(requested / STITCH_INSTANCE_LIMIT) : 1

  const matrices: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scaleVector = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const outward = new THREE.Vector3(0, 0, 1)

  let seen = 0

  for (let index = 1; index < rings.length; index += 1) {
    const ring = rings[index] as Ring
    const previous = rings[index - 1] as Ring
    const stitches = ring.stitches
    if (stitches <= 0) continue

    const rowHeight = Math.max(0.05, ring.y - previous.y)
    // A stitch is as wide as the round divided by its stitch count.
    const stitchWidth = (2 * Math.PI * ring.radius) / stitches
    const size = Math.max(stitchWidth, rowHeight * 0.6) * scale

    const rowColors = ring.stitchColors
    const baseColor = new THREE.Color(ring.color)

    for (let stitch = 0; stitch < stitches; stitch += 1) {
      seen += 1
      if (seen % stride !== 0) continue

      const angle = (stitch / stitches) * Math.PI * 2
      const x = Math.cos(angle) * ring.radius
      const z = Math.sin(angle) * ring.radius * spec.depthRatio

      // Sit on the fabric, mid-row, just proud of the surface.
      position.set(x, (ring.y + previous.y) / 2, z)

      // Face outwards: the surface normal of an ellipse is not the radius.
      normal.set(Math.cos(angle), 0, Math.sin(angle) / Math.max(0.2, spec.depthRatio)).normalize()
      quaternion.setFromUnitVectors(outward, normal)
      position.addScaledVector(normal, size * 0.18)

      scaleVector.setScalar(size)
      matrix.compose(position, quaternion, scaleVector)
      matrices.push(matrix.clone())

      const own = rowColors?.[stitch]
      colors.push(own ? new THREE.Color(own) : baseColor)
    }
  }

  return {
    geometry: stitchGeometry(),
    matrices,
    colors,
    count: matrices.length,
    requested,
    capped: stride > 1,
  }
}
