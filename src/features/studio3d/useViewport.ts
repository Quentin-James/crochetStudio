import { useCallback, useEffect, useRef, useState } from 'react'
import type { ThreeConfig, YarnSettings } from '../../core/types'
import type { ModelSpec } from '../../three/model/silhouette'
import { Viewport, type CameraPose, type PresetView } from '../../three/scene/Viewport'

interface UseViewportArgs {
  spec: ModelSpec
  yarn: YarnSettings
  three: ThreeConfig
  /** Identity of the project, so the camera is only restored when it changes. */
  projectId: string
  /** Receives the camera pose after the user stops moving. */
  onPoseSettled: (pose: CameraPose) => void
}

/**
 * React lifecycle around the Three.js viewport.
 *
 * The scene is created once and mutated afterwards: a colour change updates a
 * material, a pattern change rebuilds geometry. Nothing is torn down and rebuilt
 * on every React render, and everything is disposed on unmount — a leaked WebGL
 * context is the one mistake an iPad does not forgive.
 */
export function useViewport({
  spec,
  yarn,
  three,
  projectId,
  onPoseSettled,
}: UseViewportArgs) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const restoredForRef = useRef<string | null>(null)
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poseCallbackRef = useRef(onPoseSettled)

  const [supported] = useState(() => Viewport.isSupported())
  const [triangleCount, setTriangleCount] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)

  poseCallbackRef.current = onPoseSettled

  // Create the viewport, and keep it sized to its container.
  useEffect(() => {
    if (!supported) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let viewport: Viewport
    try {
      viewport = new Viewport(canvas)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
      return
    }

    viewportRef.current = viewport

    viewport.onPoseChange((pose) => {
      if (poseTimerRef.current !== null) clearTimeout(poseTimerRef.current)
      poseTimerRef.current = setTimeout(() => poseCallbackRef.current(pose), 500)
    })

    const observer = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container
      viewport.resize(clientWidth, clientHeight)
    })
    observer.observe(container)
    viewport.resize(container.clientWidth, container.clientHeight)

    return () => {
      observer.disconnect()
      if (poseTimerRef.current !== null) clearTimeout(poseTimerRef.current)
      viewport.dispose()
      viewportRef.current = null
      restoredForRef.current = null
    }
  }, [supported])

  // Rebuild the geometry whenever the pattern or measurements change.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const { triangleCount: triangles } = viewport.setModel(spec, yarn, three)
    setTriangleCount(triangles)

    // Restore the saved camera once per project; afterwards the user is in charge.
    if (restoredForRef.current !== projectId) {
      restoredForRef.current = projectId
      viewport.fit()
      if (three.cameraDistance > 0) {
        viewport.restorePose({
          azimuth: three.cameraAzimuth,
          polar: three.cameraPolar,
          distance: three.cameraDistance,
        })
      }
    }
    // `yarn` and `three` are read here but intentionally not dependencies: their
    // changes are applied by the appearance effect below without a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, projectId])

  // Appearance only: no geometry work.
  useEffect(() => {
    viewportRef.current?.updateAppearance(yarn, three)
  }, [yarn, three])

  useEffect(() => {
    viewportRef.current?.setBackground(three.backgroundTone)
  }, [three.backgroundTone])

  useEffect(() => {
    viewportRef.current?.setGrid(three.showGrid)
  }, [three.showGrid])

  useEffect(() => {
    viewportRef.current?.setWireframe(three.wireframe)
  }, [three.wireframe])

  useEffect(() => {
    viewportRef.current?.setShadow(three.showShadow)
  }, [three.showShadow])

  useEffect(() => {
    viewportRef.current?.setLightIntensity(three.lightIntensity)
  }, [three.lightIntensity])

  useEffect(() => {
    viewportRef.current?.setQuality(three.quality)
  }, [three.quality])

  const setPreset = useCallback((view: PresetView) => {
    viewportRef.current?.setPreset(view)
  }, [])

  const fit = useCallback(() => {
    viewportRef.current?.fit()
  }, [])

  const zoomBy = useCallback((factor: number) => {
    viewportRef.current?.zoomBy(factor)
  }, [])

  /** Back to the default three-quarter view, framed. */
  const resetCamera = useCallback(() => {
    viewportRef.current?.setPreset('threeQuarter')
    viewportRef.current?.fit()
  }, [])

  const capture = useCallback((): string | null => {
    return viewportRef.current?.capture() ?? null
  }, [])

  return {
    containerRef,
    canvasRef,
    supported,
    failure,
    triangleCount,
    setPreset,
    fit,
    zoomBy,
    resetCamera,
    capture,
  }
}
