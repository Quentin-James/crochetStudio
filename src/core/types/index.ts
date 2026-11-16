/**
 * Crochet Studio — domain vocabulary.
 *
 * This is pure TypeScript with no runtime dependencies. Every other module
 * (persistence, UI, 3D) speaks in these types.
 *
 * UNIT RULE: every length in a stored type is in CENTIMETRES. Imperial display
 * is a conversion at the edge of the UI only. See `core/units`.
 */

export type Id = string

/* ------------------------------------------------------------------ units -- */

export type UnitSystem = 'metric' | 'imperial'

/* --------------------------------------------------------------- stitches -- */

/** Standard (US-terminology) crochet stitches supported by the engine. */
export type StitchId = 'ch' | 'sl' | 'sc' | 'hdc' | 'dc' | 'tr'

export interface StitchDefinition {
  id: StitchId
  /** French name, e.g. "Bride". */
  name: string
  /** French abbreviation used in written patterns, e.g. "br". */
  abbreviation: string
  /**
   * The US name and abbreviation, kept because most patterns found online use
   * US terms and the same word means a different stitch in each system.
   */
  usEquivalent: string
  /**
   * Height of one row of this stitch relative to one row of single crochet.
   * Used to estimate row height when the user has not swatched this stitch.
   */
  heightRatio: number
  /** Relative yarn consumption per stitch, with single crochet as 1. */
  yarnRatio: number
  /** Number of yarn-overs before inserting the hook — drives the 3D geometry. */
  yarnOvers: number
  description: string
}

/* ------------------------------------------------------------------ yarn --- */

/** Craft Yarn Council weight categories 0-7. */
export type YarnWeight =
  | 'lace'
  | 'superFine'
  | 'fine'
  | 'light'
  | 'medium'
  | 'bulky'
  | 'superBulky'
  | 'jumbo'

/** A named colour the user has added to the project's palette. */
export interface YarnColor {
  id: Id
  label: string
  /** Hex colour, e.g. "#D9B6B0". */
  color: string
}

export interface YarnSettings {
  /** Free-text name of the yarn the user is working with. */
  name: string
  weight: YarnWeight
  /**
   * The main colour: used wherever no palette colour has been assigned, and as
   * the colour of a single-colour project.
   */
  color: string
  /**
   * Extra colours available to this project. Sections and rows reference them by
   * id, which is what lets a piece be striped or worked in blocks of colour.
   */
  palette: YarnColor[]
  /** Strand diameter in millimetres; drives 3D yarn thickness. */
  strandDiameterMm: number
  fibre: string
  /** Metres per 100 g, used for yardage estimates. Null when unknown. */
  metresPer100g: number | null
}

/* ----------------------------------------------------------------- gauge --- */

/**
 * A gauge swatch. Counts are measured over an explicit swatch size rather than
 * assumed to be 10cm, so a user who swatched over 4 inches loses no precision.
 */
export interface Gauge {
  stitchCount: number
  rowCount: number
  swatchWidthCm: number
  swatchHeightCm: number
  /** The stitch the swatch was worked in. */
  stitch: StitchId
  hookSizeMm: number
}

/* ------------------------------------------------------------------ size --- */

export type StandardSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

/** Body measurement keys used by the size tables and generators. */
export type MeasurementKey =
  | 'bust'
  | 'waist'
  | 'hip'
  | 'shoulderWidth'
  | 'backLength'
  | 'armLength'
  | 'armCircumference'
  | 'neckCircumference'

export type Measurements = Partial<Record<MeasurementKey, number>>

export interface SizeProfile {
  id: Id
  name: string
  /** The standard size this profile was derived from, if any. */
  basedOn: StandardSize | null
  measurements: Measurements
  createdAt: number
  updatedAt: number
}

export interface SizingState {
  /** The size currently driving calculations. */
  activeSize: StandardSize | 'custom'
  /** Set when `activeSize` is 'custom'. */
  customProfileId: Id | null
  /** Per-size measurement overrides the user has typed by hand. */
  overrides: Partial<Record<StandardSize, Measurements>>
  /** Ease added to body measurements, in cm; negative for negative ease. */
  easeCm: number
}

/* ------------------------------------------------------------ dimensions -- */

/** Named finished-garment dimensions, in cm. Which keys apply depends on category. */
export type DimensionKey =
  | 'width'
  | 'height'
  | 'length'
  | 'circumference'
  | 'depth'
  | 'strapLength'
  | 'strapWidth'
  | 'handleDrop'
  | 'skirtLength'
  | 'bodiceLength'

export type Dimensions = Partial<Record<DimensionKey, number>>

/* --------------------------------------------------------------- pattern -- */

export type WorkDirection = 'flat' | 'inTheRound'

export type ShapingKind = 'even' | 'increase' | 'decrease'

export interface RowShaping {
  kind: ShapingKind
  /** Change in stitch count applied on this row. Zero for 'even'. */
  delta: number
}

export interface PatternRow {
  id: Id
  /** 1-based position within its section. */
  index: number
  stitch: StitchId
  stitchCount: number
  shaping: RowShaping
  /** Written instruction. Generated rows get one; the user may replace it. */
  instruction: string
  note: string
  /**
   * True once the user has hand-edited this row. Recalculation preserves locked
   * rows and raises a conflict instead of silently overwriting them.
   */
  locked: boolean
  /**
   * Palette colour for this row, which is how stripes are expressed. Null means
   * "whatever the section uses".
   */
  colorId: Id | null
  /**
   * Colour of individual stitches, for colourwork: stitch index (0-based) →
   * palette colour id. Sparse and null when the row is a single colour, because
   * a fully painted dress would otherwise store 27 000 entries.
   */
  stitchColors: Record<number, Id> | null
}

export interface PatternSection {
  id: Id
  name: string
  direction: WorkDirection
  rows: PatternRow[]
  notes: string
  /** Set when this section was produced by a generator, for traceability. */
  generatedBy: string | null
  /** Palette colour for the whole section. Null means the main yarn colour. */
  colorId: Id | null
}

export interface Pattern {
  sections: PatternSection[]
  /** Stitch repeat the pattern must stay a multiple of; 1 means unconstrained. */
  repeat: number
  /** Extra edge stitches added outside the repeat, e.g. selvedge. */
  edgeStitches: number
  /** Floor applied to every calculated round; 0 means only the structural minimum. */
  minStitches: number
  /** Stitches added or removed per shaping row. Two suits flat panels, six rounds. */
  shapingStep: number
}

/* ------------------------------------------------------- derivation trail -- */

/**
 * Why a number is what it is. Returned alongside every calculated value so the
 * UI can show the user the arithmetic instead of a magic result.
 */
export interface Derivation {
  label: string
  formula: string
  inputs: Record<string, number | string>
  rawResult: number
  finalResult: number
  adjustments: DerivationAdjustment[]
}

export interface DerivationAdjustment {
  reason: string
  from: number
  to: number
}

/* ------------------------------------------------------------------- 3D --- */

export type RenderQuality = 'standard' | 'high'

/**
 * How the fabric is drawn.
 * `texture` shades the stitch relief onto a smooth surface — cheap, works
 * everywhere. `geometry` builds one small mesh per stitch, so the stitches are
 * really there and can each take their own colour.
 */
export type StitchRender = 'texture' | 'geometry'

export interface ThreeConfig {
  /** Camera orbit state so a project reopens at the angle the user left it. */
  cameraAzimuth: number
  cameraPolar: number
  cameraDistance: number
  showStitchDetail: boolean
  /** Shaded relief, or one mesh per stitch. */
  stitchRender: StitchRender
  /** Multiplier on the yarn strand diameter when rendering. */
  yarnThicknessScale: number
  /** Multiplier on the stitch grain density, for a finer or coarser fabric. */
  stitchScale: number
  backgroundTone: 'ivory' | 'cream' | 'brown'
  /** Reference grid under the model, for judging proportions. */
  showGrid: boolean
  /** Wireframe view, for inspecting the generated geometry itself. */
  wireframe: boolean
  /** A soft contact shadow on the ground — an approximation, not ray-traced. */
  showShadow: boolean
  /** Studio light intensity. */
  lightIntensity: number
  /** Device-pixel budget: 'standard' renders at 1×, 'high' up to 2×. */
  quality: RenderQuality
}

/* -------------------------------------------------------------- projects -- */

export type ProjectCategory = 'dress' | 'bag' | 'accessory'

export interface ProjectProgress {
  /** Rows the user has marked as worked. */
  completedRows: number
  /** Mirror of the pattern's total row count, kept for cheap list rendering. */
  totalRows: number
}

export interface Project {
  id: Id
  name: string
  category: ProjectCategory
  tags: string[]
  createdAt: number
  updatedAt: number
  /** Data-URL preview rendered from the 3D scene; null until one is captured. */
  thumbnail: string | null

  dimensions: Dimensions
  gauge: Gauge
  yarn: YarnSettings
  sizing: SizingState
  pattern: Pattern
  three: ThreeConfig
  notes: string
  progress: ProjectProgress

  /** Per-document schema version, so migrations can upgrade documents lazily. */
  schemaVersion: number
}

/** Fields a user supplies when creating a project; everything else is defaulted. */
export interface ProjectDraft {
  name: string
  category: ProjectCategory
  dimensions?: Dimensions
  gauge?: Partial<Gauge>
  yarn?: Partial<YarnSettings>
}

/* -------------------------------------------------------------- settings -- */

export interface AppSettings {
  units: UnitSystem
  defaultSize: StandardSize
  defaultGauge: Gauge
  defaultYarn: YarnSettings
  /** Autosave debounce in milliseconds. */
  autosaveDelayMs: number
  /** Timestamp of the last successful backup export, for the reminder nudge. */
  lastBackupAt: number | null
  /**
   * The project the studio workspaces operate on, so Pattern Studio and 3D
   * Studio reopen on the piece the user was last working on.
   */
  activeProjectId: Id | null
}
