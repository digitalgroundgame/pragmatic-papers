/**
 * The drilldown mode's asset contract.
 *
 * Everything the mode renders comes out of self-contained SVG assets a writer uploads to
 * `map-assets`: an **overview** asset whose paths carry region facts as `data-*` attributes,
 * and one **child** asset per drillable region whose `<metadata>` carries the records that
 * belong to it. Nothing here knows what a circuit, a county or a judge is — the asset
 * declares its own vocabulary through the `display` configuration below.
 *
 * `.claude/skills/interactive-maps/SKILL.md` documents the contract for writers; this file
 * is the source of truth the docs describe.
 */

/** `data-*` attributes on a path, keyed WITHOUT the `data-` prefix (`data-seats` → `seats`). */
export type FactMap = Record<string, string>

export interface DrilldownPath {
  /** The region key (`id` attribute). `null` for decorative geometry. */
  id: string | null
  d: string
  layer: string | null
  /** `data-parent-id`. `null` marks a top-level region. */
  parentId: string | null
  /** `data-inset="true"`: exempt from geometric interpolation; crossfades instead. */
  inset: boolean
  /** `data-region-label`. */
  label: string | null
  /** Every other `data-*` attribute — opaque facts surfaced to the tooltip and pane. */
  facts: FactMap
}

export type ViewBox = [x: number, y: number, width: number, height: number]

export interface DrilldownAsset {
  viewBox: ViewBox | null
  /**
   * Whether the file's wrapping `<g>` carried a `scale(1,-1)` Y-flip. The flip itself is
   * recomputed from the viewBox at render time rather than trusted from the file.
   */
  flipY: boolean
  paths: DrilldownPath[]
  payload: DrilldownPayload | null
  /** Why `payload` is null when the file did carry a `<metadata>` element. */
  payloadError: string | null
}

// ---- <metadata> payload -----------------------------------------------------------------

export const DRILLDOWN_SCHEMA = "pragmatic-papers/drilldown-map@1"

/** A region with no geometry of its own — listed in the selector, drawn only as a seat block. */
export interface DeclaredRegion {
  id: string
  label?: string
  parentId?: string
  facts?: FactMap
}

export interface FactsConfig {
  /** Display label per fact key; unlisted facts are humanised from the attribute name. */
  labels?: Record<string, string>
  /** Facts never shown to the reader (machine inputs, ids, …). */
  hide?: string[]
  /** Display order; unlisted facts follow in attribute order. */
  order?: string[]
}

export interface SeatGroup {
  /** Fact holding this group's seat count. */
  fact: string
  label: string
  /** Any CSS color. `var(--map-positive-3)` style tokens keep it theme-aware. */
  color: string
}

/**
 * One small square per seat, grouped by colour with vacancies last, parked next to the
 * region it belongs to. Drawn for the regions visible in the current view.
 */
export interface SeatBlockConfig {
  /** Fact holding the total number of seats. Vacant = total − Σ groups. */
  totalFact: string
  groups: SeatGroup[]
  vacant?: { label: string }
  /** Fact holding `"x,y"` in the asset's projected units; default is the shape's centre. */
  anchorFact?: string
  /** Fact holding a short label drawn above the block. */
  labelFact?: string
}

export interface CategoryValue {
  value: string
  label: string
  /** Short form for the seat-chart count line ("R-appointed 6 of 11"). */
  shortLabel?: string
  color: string
}

export type DetailFormat =
  | "text"
  | "date"
  | "years-since"
  | "term"
  | "link"
  | "reported"
  | "portrait"

export interface DetailCondition {
  field: string
  in?: unknown[]
  notIn?: unknown[]
  truthy?: boolean
}

export interface DetailLine {
  label?: string
  field: string
  format?: DetailFormat
  /** `term`: the field holding the term's end date. */
  endField?: string
  /** `reported`: optional qualifier and citation fields. */
  basisField?: string
  sourceField?: string
  /** `portrait`: the `lookups` table whose key is this field's value. */
  lookup?: string
  when?: DetailCondition
}

/**
 * One row of a lookup table: what is known about a value a record refers to by name. A judge
 * names their appointing president; the president's face is a fact about the president, so it
 * lives here rather than being copied onto every judge they appointed.
 */
export interface LookupEntry {
  image?: string
  label?: string
  source?: string
}

export interface RecordDisplay {
  /** Field holding the record's full name. */
  title: string
  /** Field holding the compact label under the avatar. */
  shortTitle?: string
  image?: { url: string; source?: string; license?: string; credit?: string }
  category: {
    field: string
    values: CategoryValue[]
    other?: { label: string; color: string }
  }
  /** Field to sort by (ISO date or number), ascending. */
  order?: string
  status?: {
    field: string
    /** Values that sit outside the seat count (drawn muted, in the outer band). */
    supernumerary?: string[]
    labels?: Record<string, string>
  }
  /** Region fact holding the number of seats for the seat-chart view. */
  seatsFact?: string
  flags?: { field: string; label: string; symbol?: string }[]
  /** Field whose shared value highlights a cohort on hover. */
  cohort?: string
  /** Boolean fields offered as an on-map marker toggle. */
  marks?: { field: string; label: string }[]
  details: DetailLine[]
}

export type DrilldownRecord = Record<string, unknown> & {
  /** Region the record belongs to. */
  _region: string
  /**
   * Stable identity for the record, unique across the whole drilldown. Optional — the bench
   * does not need it — but search does: it is what a result carries so the pane can pin the
   * record again once its region's asset has loaded.
   */
  _id?: string
  /** `associate` records sit beside the bench, not in it. Default `seat`. */
  _role?: "seat" | "associate"
}

export interface RecordsConfig {
  items: DrilldownRecord[]
  display: RecordDisplay
}

export interface DrilldownPayload {
  schema: typeof DRILLDOWN_SCHEMA
  regions?: DeclaredRegion[]
  facts?: FactsConfig
  seats?: SeatBlockConfig
  records?: RecordsConfig
  /** Side tables a `portrait` detail line reads, keyed by table name then by value. */
  lookups?: Record<string, Record<string, LookupEntry>>
}

// ---- resolved model -----------------------------------------------------------------------

export interface RegionNote {
  text: string
  /** `seats` notes show only in the seat-chart view. */
  mode: "always" | "seats"
}

export interface RegionInfo {
  id: string
  label: string
  parentId: string | null
  inset: boolean
  hasGeometry: boolean
  layer: string | null
  /** Display facts, reserved keys removed. */
  facts: FactMap
  /** Reserved `data-summary`: the pane's one-line meta text. */
  summary: string | null
  notes: RegionNote[]
  /** Reserved `data-children-label`: noun for the drill-in control ("districts"). */
  childrenLabel: string | null
  /** Reserved `data-order`: selector sort key. */
  order: number | null
}

export interface RegionIndex {
  byId: Record<string, RegionInfo>
  /** Top-level region ids in selector order. */
  topLevel: string[]
  /** Child region ids per parent, in selector order. */
  childrenOf: Record<string, string[]>
}

export interface ChildAssetRef {
  regionId: string
  /** Same-origin, stable path under the map-assets upload URL. */
  url: string
}
