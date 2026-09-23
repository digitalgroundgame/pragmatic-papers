/**
 * The ownership split behind every interactive page. Three sources, two owners:
 *
 *   geometry      — parsed region shapes, checked into this repo            Pragmatic Papers
 *   presentation  — labels, colours, ordering, formats, seat grouping       Pragmatic Papers
 *   data          — region facts and records, synced from a researcher's feed   the researcher
 *
 * The rule that keeps it honest: **data carries values and meanings; code carries appearance.**
 * A feed may say `party: "D"`; only the profile says what colour "D" is. `compose.ts` reads
 * `facts`, `seats` and `display` from the profile and nowhere else, so a feed cannot set a
 * colour, a label or an order even if it tries.
 */
import type {
  DeclaredRegion,
  DrilldownPath,
  DrilldownRecord,
  FactsConfig,
  RegionIcons,
  RecordDisplay,
  SeatBlockConfig,
  ViewBox,
} from "@/interactives/engine/types"

import type React from "react"

import type { FileSource } from "@/integrations/files"
import type { Integration } from "@/integrations/types"

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

/** Where a `portrait` detail line gets its faces: a named dataset, and the fields to read. */
export interface LookupSource {
  dataset: string
  image?: string
  label?: string
  source?: string
}

/** Everything about how a region's facts and records look. Never read from a feed. */
export interface DrilldownPresentation {
  facts?: FactsConfig
  seats?: SeatBlockConfig
  /** Icons for the region rail, by region id or by the layer a region is drawn on. */
  icons?: RegionIcons
  display: RecordDisplay
  /** Side tables built from `datasets`, keyed by the name a detail line's `lookup` names. */
  lookups?: Record<string, LookupSource>
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
  /**
   * Which upstream revision to read. `"release"` (the default) means the newest published data
   * release, which the adapter resolves; anything else is honoured verbatim.
   */
  ref: string
  fetchImpl?: typeof fetch
  /** Read from here instead of upstream — a checkout on disk, or a memory source in tests. */
  files?: FileSource
}

export interface FeedSnapshot<Raw> {
  /** Upstream's version stamp at the time of the fetch. */
  version: string
  generatedAt: string
  /**
   * The revision actually read, when the adapter resolved one itself. Recorded on the
   * snapshot so its provenance names an immutable tag rather than "release".
   */
  ref?: string
  raw: Raw
}

/** How one upstream is read and reshaped, so the researcher only has to keep publishing. */
export interface FeedAdapter<Raw> {
  /**
   * The outside connection this feed reads through (`@/integrations`): it owns the credential
   * and the transport, the adapter owns the shape of what comes back.
   */
  integration: Integration
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
   * A short line of provenance for the page header, beside "Data as of …". Derived from the
   * snapshot, so it says something the feed knows and the editorial copy cannot.
   */
  metaLine?(input: { data: DrilldownData }): string | null
  /**
   * The landing view shown before a reader picks a region. `compose` runs on the server and is
   * cached with the overview, so its result must be serialisable; `render` is the only place
   * that knows the shape, which keeps it inside the profile.
   */
  summary?: {
    compose(input: { presentation: DrilldownPresentation; data: DrilldownData }): unknown
    render(composed: unknown): React.ReactNode
  }
}
