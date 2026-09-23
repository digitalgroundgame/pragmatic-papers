import { compareByField, isSupernumerary } from "./recordFormat"
import type {
  ChildAssetRef,
  DrilldownAsset,
  DrilldownPayload,
  DrilldownRecord,
  RecordDisplay,
  RegionIndex,
} from "./types"

/** Nearest region (self first, then ancestors) that has a child asset, or null. */
export function assetKeyFor(
  regionId: string,
  regions: RegionIndex,
  childAssets: ChildAssetRef[],
): string | null {
  const keys = new Set(childAssets.map((a) => a.regionId))
  let cur: string | null = regionId
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    if (keys.has(cur)) return cur
    seen.add(cur)
    cur = regions.byId[cur]?.parentId ?? null
  }
  return null
}

export interface RegionRecords {
  /** Bench members, in their display's `order`; supernumerary members included. */
  seats: DrilldownRecord[]
  display: RecordDisplay | null
  /** Records that sit beside the bench rather than in it (a presiding officer, a liaison). */
  associates: { record: DrilldownRecord; display: RecordDisplay }[]
}

/**
 * Records for a region come from the payload of the child asset that covers it (the parent's
 * bench and its children's benches travel together) and from the overview payload (small
 * cross-cutting sets, such as who presides over each top-level region).
 */
export function recordsFor(
  regionId: string,
  overview: DrilldownAsset,
  childAsset: DrilldownAsset | null,
): RegionRecords {
  const sources: DrilldownPayload["records"][] = [
    childAsset?.payload?.records,
    overview.payload?.records,
  ]
  const seats: DrilldownRecord[] = []
  let display: RecordDisplay | null = null
  const associates: RegionRecords["associates"] = []
  for (const src of sources) {
    if (!src) continue
    for (const item of src.items) {
      if (item._region !== regionId) continue
      if (item._role === "associate") associates.push({ record: item, display: src.display })
      else {
        seats.push(item)
        display ??= src.display
      }
    }
  }
  if (display) seats.sort(compareByField(display.order))
  return { seats, display, associates }
}

export interface Bench {
  active: DrilldownRecord[]
  supernumerary: DrilldownRecord[]
  seatCount: number
  vacancies: number
}

/** Splits a bench into active members and supernumerary ones, and sizes the vacancies. */
export function buildBench(
  seats: DrilldownRecord[],
  display: RecordDisplay | null,
  seatFactValue: string | undefined,
): Bench {
  const active: DrilldownRecord[] = []
  const supernumerary: DrilldownRecord[] = []
  for (const r of seats) (display && isSupernumerary(r, display) ? supernumerary : active).push(r)
  const declared = Number(seatFactValue)
  const seatCount =
    Number.isFinite(declared) && declared > 0 ? Math.max(declared, active.length) : active.length
  return { active, supernumerary, seatCount, vacancies: Math.max(0, seatCount - active.length) }
}
