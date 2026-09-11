import { unstable_cache } from "next/cache"
import { draftMode } from "next/headers"
import { cache } from "react"

import { interactivePath, interactiveTag } from "@/collections/InteractiveSnapshots/tag"
import type { SearchIndex } from "@/interactives/engine/search"
import type { ChildAssetRef, DrilldownAsset } from "@/interactives/engine/types"
import type { Interactive } from "@/payload-types"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { isRecord } from "@/utilities/isRecord"

import { childKeys, composeChildData, composeChildGeometry, composeOverview } from "./compose"
import { geometryHash, profileFingerprint } from "./hash"
import { getProfile } from "./profiles"
import { composeSearchIndex } from "./search"
import { DRILLDOWN_DATA_SCHEMA, type DrilldownData, type InteractiveProfile } from "./types"

/**
 * Server-side loading for an interactive page. Two rules keep it cheap and correct:
 *
 * - The snapshot is megabytes. It is read once per request (`React.cache`); what is cached
 *   across requests is the *composed* asset for one view, tagged so the sync can drop them.
 * - In draft mode nothing is cached and the newest snapshot version is read, so an editor
 *   previewing from the admin sees the researcher's latest data before publishing it.
 */

export const queryInteractiveBySlug = cache(async (slug: string): Promise<Interactive | null> => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "interactives",
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: { slug: { equals: slug } },
    depth: 1,
  })
  return docs[0] ?? null
})

/** The snapshot as the sync validated it; drafts only when asked. */
const readSnapshotData = cache(
  async (interactiveId: number, draft: boolean): Promise<DrilldownData | null> => {
    const payload = await getPayloadConfig()
    const { docs } = await payload.find({
      collection: "interactive-snapshots",
      where: { interactive: { equals: interactiveId } },
      draft,
      overrideAccess: draft,
      limit: 1,
      depth: 0,
      pagination: false,
    })
    const data = docs[0]?.data
    if (!isRecord(data) || data.schema !== DRILLDOWN_DATA_SCHEMA) return null
    return data as unknown as DrilldownData
  },
)

/**
 * The code half of the cache key, worked out once per profile per process. The geometry it
 * hashes is imported JSON held for the life of the process, so this is one pass over it.
 */
const fingerprints = new Map<string, Promise<string>>()

function fingerprintOf(profile: InteractiveProfile): Promise<string> {
  const held = fingerprints.get(profile.id)
  if (held) return held
  const computed = profile
    .loadGeometry()
    .then((geometry) => profileFingerprint(profile.presentation, geometry))
  fingerprints.set(profile.id, computed)
  return computed
}

export interface ComposedOverview {
  overview: DrilldownAsset
  childAssets: ChildAssetRef[]
  /** Same-origin route serving the record search index, fetched on the reader's first query. */
  searchUrl: string
  /** The profile's landing-view payload, or null when it declares no summary. */
  summary: unknown
  /** A line of provenance for the header, beside "Data as of …", or null. */
  metaLine: string | null
  /** When upstream generated the data the page is showing, and who upstream is. */
  generatedAt: string
  source: DrilldownData["source"]
  /** Configuration problems worth surfacing to an editor; the page still renders. */
  problems: string[]
}

async function composeOverviewFor(
  interactive: Interactive,
  profile: InteractiveProfile,
  draft: boolean,
): Promise<ComposedOverview | null> {
  const [data, geometry] = await Promise.all([
    readSnapshotData(interactive.id, draft),
    profile.loadGeometry(),
  ])
  if (!data) return null
  const overview = composeOverview({ presentation: profile.presentation, geometry, data })
  // Two URLs per region, because the halves change on different clocks. The geometry's
  // carries a hash of itself, so a browser can hold it forever and a reprojection issues a new one.
  const childAssets = childKeys(geometry).map((regionId) => {
    const base = `${interactivePath(interactive.slug)}/regions/${encodeURIComponent(regionId)}`
    return {
      regionId,
      url: base,
      geometryUrl: `${base}/geometry/${geometryHash(geometry.children[regionId] ?? null)}`,
    }
  })
  const problems: string[] = []
  if (overview.viewBox === null) problems.push("overview geometry has no usable viewBox")
  return {
    overview,
    childAssets,
    searchUrl: `${interactivePath(interactive.slug)}/search`,
    summary: profile.summary?.compose({ presentation: profile.presentation, data }) ?? null,
    metaLine: profile.metaLine?.({ data }) ?? null,
    generatedAt: data.generatedAt,
    source: data.source,
    problems,
  }
}

async function composeChildFor(
  interactive: Interactive,
  profile: InteractiveProfile,
  regionId: string,
  draft: boolean,
): Promise<DrilldownAsset | null> {
  const [data, geometry] = await Promise.all([
    readSnapshotData(interactive.id, draft),
    profile.loadGeometry(),
  ])
  if (!data) return null
  return composeChildData({ presentation: profile.presentation, geometry, data }, regionId)
}

/** The overview view of an interactive, or null when it has no snapshot to show. */
export async function loadInteractiveOverview(
  interactive: Interactive,
): Promise<ComposedOverview | null> {
  const profile = getProfile(interactive.profile)
  if (!profile) return null
  const { isEnabled: draft } = await draftMode()
  if (draft) return composeOverviewFor(interactive, profile, true)
  return unstable_cache(
    () => composeOverviewFor(interactive, profile, false),
    [
      "interactive-overview",
      String(interactive.id),
      interactive.slug,
      await fingerprintOf(profile),
    ],
    // The tag is what invalidates this on a publish; the TTL is what still invalidates it if
    // that tag write is ever missed — the scheduled sync's own revalidateTag call runs outside
    // a request scope and can throw (see syncInteractiveData/index.ts). An hour matches the
    // s-maxage this same data is served with over HTTP, so the two layers agree on how stale
    // "worst case" means.
    { tags: [interactiveTag(interactive.id)], revalidate: 3600 },
  )()
}

/** One region's shapes. Code, not data: no snapshot read, and cacheable forever by its hash. */
export async function loadInteractiveGeometry(
  interactive: Interactive,
  regionId: string,
): Promise<DrilldownAsset | null> {
  const profile = getProfile(interactive.profile)
  if (!profile) return null
  return composeChildGeometry(await profile.loadGeometry(), regionId)
}

/**
 * The hash that names one region's geometry right now, or null for a region with no entry at
 * all. Read by the geometry route to check the URL it was asked for against the file it would
 * actually serve — the same computation `childKeys` used to build that URL in the first place,
 * so the two can never quietly disagree. `loadGeometry` is memoised per process, so this costs
 * nothing beyond the `loadInteractiveGeometry` call the route already makes.
 */
export async function loadInteractiveGeometryHash(
  interactive: Interactive,
  regionId: string,
): Promise<string | null> {
  const profile = getProfile(interactive.profile)
  if (!profile) return null
  const geometry = await profile.loadGeometry()
  if (!Object.prototype.hasOwnProperty.call(geometry.children, regionId)) return null
  return geometryHash(geometry.children[regionId] ?? null)
}

/** One region's records, or null when the region is not drillable / there is no snapshot. */
export async function loadInteractiveRegion(
  interactive: Interactive,
  regionId: string,
): Promise<DrilldownAsset | null> {
  const profile = getProfile(interactive.profile)
  if (!profile) return null
  const { isEnabled: draft } = await draftMode()
  if (draft) return composeChildFor(interactive, profile, regionId, true)
  return unstable_cache(
    () => composeChildFor(interactive, profile, regionId, false),
    ["interactive-region", String(interactive.id), regionId, await fingerprintOf(profile)],
    // See loadInteractiveOverview: the TTL is the fallback for a missed tag invalidation, not
    // the primary one, and it matches this route's own s-maxage.
    { tags: [interactiveTag(interactive.id)], revalidate: 3600 },
  )()
}

async function composeSearchIndexFor(
  interactive: Interactive,
  profile: InteractiveProfile,
  draft: boolean,
): Promise<SearchIndex | null> {
  const data = await readSnapshotData(interactive.id, draft)
  if (!data) return null
  return composeSearchIndex({ presentation: profile.presentation, data })
}

/** The record search index, or null when the interactive has no snapshot to search. */
export async function loadInteractiveSearchIndex(
  interactive: Interactive,
): Promise<SearchIndex | null> {
  const profile = getProfile(interactive.profile)
  if (!profile) return null
  const { isEnabled: draft } = await draftMode()
  if (draft) return composeSearchIndexFor(interactive, profile, true)
  return unstable_cache(
    () => composeSearchIndexFor(interactive, profile, false),
    ["interactive-search", String(interactive.id), interactive.slug, await fingerprintOf(profile)],
    // See loadInteractiveOverview: the TTL is the fallback for a missed tag invalidation, not
    // the primary one, and it matches this route's own s-maxage.
    { tags: [interactiveTag(interactive.id)], revalidate: 3600 },
  )()
}
