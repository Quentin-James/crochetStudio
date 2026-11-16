import type {
  AppSettings,
  Gauge,
  Pattern,
  ProjectProgress,
  SizingState,
  ThreeConfig,
  YarnSettings,
} from './types'

/**
 * Canonical starting values.
 *
 * These are sane, real-world defaults (a DK yarn on a 4 mm hook worked in double
 * crochet), not placeholders: the user is expected to replace the gauge with
 * their own swatch, which the UI prompts for.
 */

export const DEFAULT_GAUGE: Gauge = {
  stitchCount: 20,
  rowCount: 15,
  swatchWidthCm: 10,
  swatchHeightCm: 10,
  stitch: 'dc',
  hookSizeMm: 4,
}

export const DEFAULT_YARN: YarnSettings = {
  name: 'Fil sans nom',
  weight: 'light',
  color: '#D9B6B0',
  palette: [],
  strandDiameterMm: 2,
  fibre: 'Coton',
  metresPer100g: 250,
}

export const DEFAULT_SIZING: SizingState = {
  activeSize: 'M',
  customProfileId: null,
  overrides: {},
  easeCm: 0,
}

export const DEFAULT_PATTERN: Pattern = {
  sections: [],
  repeat: 1,
  edgeStitches: 0,
  minStitches: 0,
  shapingStep: 6,
}

export const DEFAULT_THREE: ThreeConfig = {
  cameraAzimuth: 0.6,
  cameraPolar: 1.25,
  cameraDistance: 90,
  showStitchDetail: true,
  // Real stitch geometry by default: seeing the stitches is the point of the
  // 3D studio. It falls back to the texture above the instance cap.
  stitchRender: 'geometry',
  yarnThicknessScale: 1,
  stitchScale: 1,
  backgroundTone: 'ivory',
  showGrid: false,
  wireframe: false,
  showShadow: true,
  lightIntensity: 1,
  quality: 'high',
}

export const DEFAULT_PROGRESS: ProjectProgress = {
  completedRows: 0,
  totalRows: 0,
}

export const DEFAULT_SETTINGS: AppSettings = {
  units: 'metric',
  defaultSize: 'M',
  defaultGauge: DEFAULT_GAUGE,
  defaultYarn: DEFAULT_YARN,
  autosaveDelayMs: 600,
  lastBackupAt: null,
  activeProjectId: null,
}

/**
 * Bumped whenever the shape of a stored project document changes.
 * v2 added the yarn palette and the colour references on sections and rows.
 */
export const PROJECT_SCHEMA_VERSION = 2
