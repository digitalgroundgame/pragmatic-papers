import { unstable_cache } from "next/cache"
import { draftMode } from "next/headers"
import { cache } from "react"

import type { ChildAssetRef, DrilldownAsset } from "@/blocks/InteractiveMap/drilldown/types"
import { interactivePath, interactiveTag } from "@/collections/InteractiveSnapshots/tag"
import type { Interactive } from "@/payload-types"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { childKeys, composeChild, composeOverview } from "./compose"
import { getProfile } from "./profiles"
import { DRILLDOWN_DATA_SCHEMA, type DrilldownData, type InteractiveProfile } from "./types"

/**
 * Server-side loading for an interactive page. Two rules keep this cheap and correct:
 *
 * - The snapshot document is megabytes. It is read once per request (`React.cache`) and what
 *   gets cached across requests is the *composed* asset for one view — the overview, or one
 *   region — each well under a megabyte, tagged so the sync and the collection hooks can drop
 *   them together.
 * - In draft mode nothing is cached and the newest snapshot version is read, draft or
 *   published. That is the preview: an editor opens the page from the admin and sees the
 *   researcher's latest data in the site's design before publishing it.
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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

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

export interface ComposedOverview {
  overview: DrilldownAsset
  childAssets: ChildAssetRef[]
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
  const childAssets = childKeys(geometry).map((regionId) => ({
    regionId,
    url: `${interactivePath(interactive.slug)}/regions/${encodeURIComponent(regionId)}`,
  }))
  const problems: string[] = []
  if (overview.viewBox === null) problems.push("overview geometry has no usable viewBox")
  return { overview, childAssets, problems }
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
  return composeChild({ presentation: profile.presentation, geometry, data }, regionId)
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
    ["interactive-overview", String(interactive.id), interactive.slug],
    { tags: [interactiveTag(interactive.id)] },
  )()
}

/** One region's lazily fetched asset, or null when the region is not drillable / no snapshot. */
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
    ["interactive-region", String(interactive.id), regionId],
    { tags: [interactiveTag(interactive.id)] },
  )()
}
