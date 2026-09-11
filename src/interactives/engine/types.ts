/**
 * The drilldown mode's asset contract: an overview asset whose paths carry region facts as
 * `data-*` attributes, and one child asset per drillable region whose `<metadata>` carries the
 * records. Nothing here knows what a circuit, a county or a judge is — the asset declares its
 * own vocabulary through the `display` configuration below.
 *
 * `.claude/skills/interactive-maps/SKILL.md` documents this for writers.
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
  /**
   * Where each block is drawn, in the units of the map it is drawn on, by region id. Placement
   * is the profile's, measured against geometry checked in beside it, so it beats `anchorFact`
   * — a feed that carries a position is describing its own map, not ours.
   */
  anchors?: Record<string, readonly number[]>
  /** Fact holding `"x,y"` in the asset's projected units; default is the shape's centre. */
  anchorFact?: string
  /** Fact holding a short label drawn above the block. */
  labelFact?: string
  /** Groups of blocks placed against each other rather than against the map. See `cluster.ts`. */
  clusters?: readonly SeatCluster[]
}

/**
 * Blocks that belong to each other rather than to a place: courts with no territory on the
 * map, read as a group and spaced in px, which holds at any width.
 */
export interface SeatCluster {
  /** The member the group hangs from, and the one the layout tools report. */
  anchor: string
  /** Members, top row first, each row drawn left to right. */
  rows: readonly (readonly string[])[]
  /** CSS px between members along a row, and between one row and the next. */
  gap?: number
  rowGap?: number
  /** How a row narrower than the widest one sits against it. Defaults to centred. */
  align?: "left" | "center" | "right"
  /**
   * How close the group's box may come to the frame's edge, in CSS px, before it is pulled
   * back. The group still hangs from the anchor member's own declared position — an anchor is
   * a place like any other — but its members are a constant size in CSS px and the frame is
   * not, so at a narrow enough width the same anchor would push them off the visible map.
   * Clamping is what keeps a group meant to be read together from spilling off one side of it
   * while the anchor itself stays exactly where the file says.
   */
  edgeMargin?: number
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
  /** Stable identity, unique across the drilldown. Optional; search is what needs it. */
  _id?: string
  /** `associate` records sit beside the bench, not in it. Default `seat`. */
  _role?: "seat" | "associate"
}

export interface RecordsConfig {
  items: DrilldownRecord[]
  display: RecordDisplay
}

/**
 * Which icon sits beside a region in the rail, named rather than imported: the profile picks
 * the name, `engine/icons` owns the allowlist it resolves to. Most specific wins — the region
 * itself, then the layer it is drawn on, then the fallback.
 */
export interface RegionIcons {
  byRegion?: Record<string, string>
  byLayer?: Record<string, string>
  default?: string
  /**
   * The fact holding a region's short form, for the rail folded to icons. A leading number is
   * the ordinal and is drawn as a Roman numeral ("9th" → IX); anything else short enough is
   * drawn as it stands ("DC"). Without it the rail falls back to the ordinary icons.
   */
  shortFact?: string
}

export interface DrilldownPayload {
  schema: typeof DRILLDOWN_SCHEMA
  regions?: DeclaredRegion[]
  facts?: FactsConfig
  seats?: SeatBlockConfig
  icons?: RegionIcons
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
  /** Reserved `data-heading`: the pane's own heading, when it differs from the short `label`
   * used everywhere else — the rail, the trail, a tooltip. */
  heading: string | null
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
  /** Same-origin path serving the region's records; changes whenever the sync does. */
  url: string
  /** Same-origin path serving its shapes, hashed so it can be held forever. */
  geometryUrl: string
}
