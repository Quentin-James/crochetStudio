import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ThreeConfig, YarnSettings } from '../../core/types'
import { BACKGROUNDS } from '../materials/yarn'
import { buildModel, type BuiltModel } from '../model/buildMesh'
import type { ModelSpec } from '../model/silhouette'

/**
 * The 3D viewport.
 *
 * Owns the renderer, camera, lights and orbit controls, and nothing else: it
 * knows about `ModelSpec` and the project's yarn and camera settings, never about
 * React or the database.
 *
 * Rendering is on demand — a frame is drawn when something changes, not sixty
 * times a second. Orbiting a static model should not drain an iPad battery.
 */

export type PresetView = 'front' | 'back' | 'left' | 'threeQuarter' | 'top'

export interface CameraPose {
  azimuth: number
  polar: number
  distance: number
}

const PRESETS: Record<PresetView, { azimuth: number; polar: number }> = {
  front: { azimuth: 0, polar: Math.PI / 2 },
  back: { azimuth: Math.PI, polar: Math.PI / 2 },
  left: { azimuth: -Math.PI / 2, polar: Math.PI / 2 },
  threeQuarter: { azimuth: Math.PI * 0.22, polar: 1.25 },
  top: { azimuth: 0, polar: 0.25 },
}

export class Viewport {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private model: BuiltModel | null = null
  private frame: number | null = null
  private disposed = false
  private poseListener: ((pose: CameraPose) => void) | null = null

  /** Scene furniture that depends on the model's size. */
  private grid: THREE.GridHelper | null = null
  private shadow: THREE.Mesh | null = null
  private readonly lights: { key: THREE.DirectionalLight; fill: THREE.DirectionalLight; ambient: THREE.HemisphereLight; rim: THREE.DirectionalLight }
  /** Bottom of the model in world space, where the floor goes. */
  private floorY = 0
  private modelRadius = 40

  /** WebGL may be unavailable (old device, disabled, software blocklist). */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas')
      return Boolean(
        canvas.getContext('webgl2') ??
          canvas.getContext('webgl') ??
          canvas.getContext('experimental-webgl'),
      )
    } catch {
      return false
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000)
    this.camera.position.set(0, 10, 90)

    this.controls = new OrbitControls(this.camera, canvas)
    // Damping would need a continuous render loop; without it the response is
    // immediate and a frame is only drawn when the user actually moves.
    this.controls.enableDamping = false
    this.controls.enablePan = true
    this.controls.minDistance = 8
    this.controls.maxDistance = 600
    this.controls.zoomSpeed = 0.8
    this.controls.rotateSpeed = 0.9
    this.controls.addEventListener('change', () => {
      this.requestRender()
      this.poseListener?.(this.currentPose())
    })

    this.lights = this.addLights()
    this.setBackground('ivory')
  }

  /**
   * Warm studio lighting: a soft wash from above, one key light to bring out the
   * stitch relief, and a dim fill so the far side is not black.
   */
  private addLights() {
    const ambient = new THREE.HemisphereLight(0xfff6ec, 0xd8c6b2, 1.15)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(0xfff1e0, 1.35)
    key.position.set(45, 70, 60)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xf3e3d6, 0.45)
    fill.position.set(-50, 20, -40)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 0.3)
    rim.position.set(0, -30, -60)
    this.scene.add(rim)

    return { ambient, key, fill, rim }
  }

  /** Scales every light together, so the studio can be brightened or softened. */
  setLightIntensity(intensity: number): void {
    const factor = clamp(intensity, 0.3, 2)
    this.lights.ambient.intensity = 1.15 * factor
    this.lights.key.intensity = 1.35 * factor
    this.lights.fill.intensity = 0.45 * factor
    this.lights.rim.intensity = 0.3 * factor
    this.requestRender()
  }

  /**
   * Pixel budget. Antialiasing cannot be toggled after the context exists, so
   * quality is expressed as resolution — which is what actually costs frames on
   * an iPad.
   */
  setQuality(quality: 'standard' | 'high'): void {
    const cap = quality === 'high' ? 2 : 1
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap))
    this.requestRender()
  }

  setWireframe(on: boolean): void {
    this.model?.setWireframe(on)
    this.requestRender()
  }

  /** A reference grid at the model's feet, sized to the model. */
  setGrid(visible: boolean): void {
    if (this.grid) {
      this.scene.remove(this.grid)
      this.grid.geometry.dispose()
      ;(this.grid.material as THREE.Material).dispose()
      this.grid = null
    }

    if (visible) {
      // Ten-centimetre divisions: the unit the user measures in.
      const extent = Math.max(40, Math.ceil((this.modelRadius * 2.6) / 10) * 10)
      const grid = new THREE.GridHelper(extent, extent / 10, 0xb98f87, 0xd8c6b2)
      grid.position.y = this.floorY
      const material = grid.material as THREE.Material
      material.transparent = true
      material.opacity = 0.5
      this.scene.add(grid)
      this.grid = grid
    }

    this.requestRender()
  }

  /**
   * A soft contact shadow.
   *
   * A radial gradient on the floor rather than a shadow map: it costs one
   * texture instead of a second render pass, and at this scale the difference is
   * not visible. The UI calls it an approximation.
   */
  setShadow(visible: boolean): void {
    if (this.shadow) {
      this.scene.remove(this.shadow)
      this.shadow.geometry.dispose()
      const material = this.shadow.material as THREE.MeshBasicMaterial
      material.map?.dispose()
      material.dispose()
      this.shadow = null
    }

    if (visible) {
      const texture = new THREE.CanvasTexture(shadowTexture())
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.modelRadius * 3.4, this.modelRadius * 3.4), material)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = this.floorY + 0.05
      this.scene.add(mesh)
      this.shadow = mesh
    }

    this.requestRender()
  }

  /** Zooms by a factor around the current target: 0.8 closer, 1.25 further. */
  zoomBy(factor: number): void {
    const pose = this.currentPose()
    this.applyPose({ ...pose, distance: pose.distance * factor })
  }

  setBackground(tone: ThreeConfig['backgroundTone']): void {
    this.scene.background = new THREE.Color(BACKGROUNDS[tone])
    this.requestRender()
  }

  /** Replaces the model. Returns what was actually built, for honest reporting. */
  setModel(
    spec: ModelSpec,
    yarn: YarnSettings,
    three: ThreeConfig,
  ): { triangleCount: number; stitches: BuiltModel['stitches'] } {
    if (this.model) {
      this.scene.remove(this.model.group)
      this.model.dispose()
      this.model = null
    }

    this.model = buildModel(spec, yarn, three)
    this.scene.add(this.model.group)

    // The floor and the grid follow the model's size.
    const height = spec.kind === 'panel' ? (spec.panel?.heightCm ?? 0) : spec.totalHeightCm
    this.floorY = -height / 2
    this.modelRadius = Math.max(8, spec.maxRadiusCm, (spec.panel?.widthCm ?? 0) / 2)

    this.model.setWireframe(three.wireframe)
    this.setGrid(three.showGrid)
    this.setShadow(three.showShadow)
    this.setLightIntensity(three.lightIntensity)
    this.setQuality(three.quality)

    this.requestRender()
    return { triangleCount: this.model.triangleCount, stitches: this.model.stitches }
  }

  /** Colour, thickness and stitch detail without rebuilding the geometry. */
  updateAppearance(yarn: YarnSettings, three: ThreeConfig): void {
    this.model?.update(yarn, three)
    this.requestRender()
  }

  /** Frames the model so it fills the view, whatever its size. */
  fit(): void {
    if (!this.model) return

    const box = new THREE.Box3().setFromObject(this.model.group)
    if (box.isEmpty()) return

    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const fov = (this.camera.fov * Math.PI) / 180
    const distance = (sphere.radius / Math.sin(fov / 2)) * 1.15

    this.controls.target.copy(sphere.center)
    this.applyPose({ ...this.currentPose(), distance })
  }

  applyPose(pose: CameraPose): void {
    const spherical = new THREE.Spherical(
      clamp(pose.distance, this.controls.minDistance, this.controls.maxDistance),
      // Never exactly 0 or π: a degenerate polar angle flips the camera.
      clamp(pose.polar, 0.05, Math.PI - 0.05),
      pose.azimuth,
    )

    this.camera.position.setFromSpherical(spherical).add(this.controls.target)
    this.camera.lookAt(this.controls.target)
    this.controls.update()
    this.requestRender()
  }

  /**
   * Applies a saved camera, unless it would be far too close for this model.
   *
   * A distance saved while inspecting a 24 cm bag would put the camera inside
   * the fabric of a 98 cm dress, which looks like a black screen rather than
   * like a mistake. Call after `fit()`: the fitted distance is the reference.
   */
  restorePose(pose: CameraPose): void {
    const fitted = this.currentPose().distance
    if (pose.distance < fitted * 0.35) return
    this.applyPose(pose)
  }

  currentPose(): CameraPose {
    const offset = this.camera.position.clone().sub(this.controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    return { azimuth: spherical.theta, polar: spherical.phi, distance: spherical.radius }
  }

  setPreset(view: PresetView): void {
    const preset = PRESETS[view]
    this.applyPose({ ...preset, distance: this.currentPose().distance })
  }

  onPoseChange(listener: (pose: CameraPose) => void): void {
    this.poseListener = listener
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  /**
   * Renders a small still of the current view as a data URL.
   *
   * Drawn at thumbnail size and read back in the same tick, which is what lets
   * the image be captured without keeping a preserved drawing buffer around.
   */
  capture(width = 420, height = 320): string {
    const previous = new THREE.Vector2()
    this.renderer.getSize(previous)

    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)

    const dataUrl = this.renderer.domElement.toDataURL('image/jpeg', 0.82)

    this.resize(previous.x, previous.y)
    return dataUrl
  }

  private requestRender(): void {
    if (this.disposed || this.frame !== null) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      if (this.disposed) return
      this.renderer.render(this.scene, this.camera)
    })
  }

  dispose(): void {
    this.disposed = true
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.poseListener = null
    this.controls.dispose()
    this.setGrid(false)
    this.setShadow(false)
    if (this.model) {
      this.scene.remove(this.model.group)
      this.model.dispose()
      this.model = null
    }
    this.renderer.dispose()
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** A radial gradient used as the contact shadow under the model. */
let cachedShadow: HTMLCanvasElement | null = null

function shadowTexture(): HTMLCanvasElement {
  if (cachedShadow) return cachedShadow

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256

  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126)
    gradient.addColorStop(0, 'rgba(68, 56, 47, 0.55)')
    gradient.addColorStop(0.55, 'rgba(68, 56, 47, 0.22)')
    gradient.addColorStop(1, 'rgba(68, 56, 47, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
  }

  cachedShadow = canvas
  return canvas
}
