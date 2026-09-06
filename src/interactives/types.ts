/**
 * The ownership split behind every interactive page.
 *
 * A drilldown interactive is assembled from three sources with two owners:
 *
 *   geometry      — parsed region shapes, checked into this repo            Pragmatic Papers
 *   presentation  — labels, colours, ordering, formats, seat grouping       Pragmatic Papers
 *   data          — region facts and records, synced from a researcher's feed   the researcher
 *
 * The rule that keeps the split honest: **data carries values and meanings; code carries
 * appearance.** A feed may say `party: "D"` or `status: "senior"`; only the profile says what
 * colour "D" is or how a senior judge is drawn. `compose.ts` reads `facts`, `seats` and
 * `display` from the code-owned profile and nowhere else, so a feed cannot set a colour, a
 * label or an order even if it tries.
 *
 * The rendering engine in `@/blocks/InteractiveMap/drilldown` is untouched by this: it still
 * consumes `DrilldownAsset`s. What changes is where an asset comes from — composed here from
 * the three sources instead of parsed out of one uploaded SVG.
 */
import type {
  DeclaredRegion,
  DrilldownPath,
  DrilldownRecord,
  FactsConfig,
  RecordDisplay,
  SeatBlockConfig,
  ViewBox,
} from "@/blocks/InteractiveMap/drilldown/types"

import type React from "react"

import type { FileSource } from "./sources/files"

// ---- data: the researcher's half ------------------------------------------------------------

export const DRILLDOWN_DATA_SCHEMA = "pragmatic-papers/drilldown-data@1"

export interface DataSource {
  /** Human name of the upstream project ("court-tracker"). */
  name: string
  /** Upstream's own version stamp — a build hash that moves whenever their output changes. */
  version: string
  /** The git ref the sync read (branch, tag or sha). */
  ref?: string
}

/**
 * What a feed carries once the adapter has reshaped it. Region facts and records only —
 * no colours, no labels-for-display, no ordering. Anything under `datasets` is opaque to the
 * drilldown engine and typed by the feature that consumes it.
 */
export interface DrilldownData {
  schema: typeof DRILLDOWN_DATA_SCHEMA
  /** When upstream generated the data (ISO 8601). */
  generatedAt: string
  source: DataSource
  /** Every region the data knows about, geometry-bearing or not, with its facts. */
  regions: DeclaredRegion[]
  records: DrilldownRecord[]
  /** Named extra datasets (appointment history, president photos, layout hints, …). */
  datasets?: Record<string, unknown>
}

// ---- presentation: Pragmatic Papers' half ----------------------------------------------------

/** Everything about how a region's facts and records look. Never read from a feed. */
export interface DrilldownPresentation {
  facts?: FactsConfig
  seats?: SeatBlockConfig
  display: RecordDisplay
}

// ---- geometry: Pragmatic Papers' half --------------------------------------------------------

/** A path with its structural attributes only; facts live in the data, never on geometry. */
export type GeometryPath = Omit<DrilldownPath, "facts">

/** One parsed SVG, as `parseDrilldownAssetString` sees it minus payload and per-path facts. */
export interface GeometryFile {
  viewBox: ViewBox | null
  flipY: boolean
  paths: GeometryPath[]
}

export interface DrilldownGeometry {
  overview: GeometryFile
  /**
   * Per drillable region id: the child geometry, or `null` for a records-only region whose
   * children are listed in the selector but have no shapes of their own.
   */
  children: Record<string, GeometryFile | null>
}

// ---- feed adapter --------------------------------------------------------------------------

export interface FeedFetchOptions {
  ref: string
  /** Credential for a private upstream; read from `FeedAdapter.tokenEnv` by the sync. */
  token?: string | null
  fetchImpl?: typeof fetch
  /** Read from here instead of upstream — a checkout on disk, or a memory source in tests. */
  files?: FileSource
}

export interface FeedSnapshot<Raw> {
  /** Upstream's version stamp at the time of the fetch. */
  version: string
  generatedAt: string
  raw: Raw
}

/**
 * How one upstream is read and reshaped. The adapter is Pragmatic Papers' code: it absorbs
 * upstream's shape so the researcher's only obligation is to keep publishing what they
 * already publish and to say when its shape changes.
 */
export interface FeedAdapter<Raw> {
  /** Env var holding the token when upstream is private. */
  tokenEnv?: string
  /** Where the feed comes from, for logs ("github:org/repo"). */
  describe(): string
  /** Upstream's current version stamp, fetched as cheaply as possible. */
  peekVersion(opts: FeedFetchOptions): Promise<string>
  fetch(opts: FeedFetchOptions): Promise<FeedSnapshot<Raw>>
  adapt(snapshot: FeedSnapshot<Raw>, opts: { ref: string }): DrilldownData
}

// ---- profile -------------------------------------------------------------------------------

/**
 * One interactive's code-owned configuration: its presentation, its geometry and the feed
 * adapter that produces its data. Registered by id in `./profiles`; an `interactives`
 * document points at a profile by that id.
 */
export interface InteractiveProfile<Raw = unknown> {
  id: string
  label: string
  presentation: DrilldownPresentation
  /** Loaded lazily — the geometry JSON is megabytes and only the page and region route need it. */
  loadGeometry(): Promise<DrilldownGeometry>
  feed: FeedAdapter<Raw>
  /**
   * The landing view shown before a reader picks a region: an overview of the whole dataset.
   *
   * `compose` runs on the server and its result is cached with the overview, so it must be
   * serialisable. `render` is the only place that knows the shape, which keeps the summary's
   * type inside the profile instead of forcing every caller to carry it.
   */
  summary?: {
    compose(input: { presentation: DrilldownPresentation; data: DrilldownData }): unknown
    render(composed: unknown): React.ReactNode
  }
}
