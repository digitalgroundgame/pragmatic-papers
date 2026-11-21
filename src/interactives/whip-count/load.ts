import { draftMode } from "next/headers"
import { cache } from "react"

import { getPayloadClient } from "@/data/payload"
import type { Interactive, InteractiveSnapshot } from "@/payload-types"
import { failure, type Result } from "@/utilities/result"

import { parseWhipCount, type WhipCountData } from "./model"

/**
 * A whip count interactive's snapshot: the published one, or the newest draft in preview.
 * Not cached across requests: the page renders per request and the edge holds its copy.
 */
const loadSnapshot = cache(
  async (interactive: Pick<Interactive, "id">): Promise<InteractiveSnapshot | undefined> => {
    const { isEnabled: draft } = await draftMode()
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: "interactive-snapshots",
      where: { interactive: { equals: interactive.id } },
      draft,
      overrideAccess: draft,
      limit: 1,
      depth: 0,
      pagination: false,
    })
    return docs[0]
  },
)

/** A whip count interactive's count, from its snapshot (`loadSnapshot`). */
export async function loadWhipCount(
  interactive: Pick<Interactive, "id">,
): Promise<Result<WhipCountData, string>> {
  const snapshot = await loadSnapshot(interactive)
  if (!snapshot) return failure("no count has been pushed to it yet")
  return parseWhipCount(snapshot.data)
}

/**
 * When the count last changed: the snapshot's stamp, which a push or an editor's change sets
 * and a push that changes nothing leaves alone. Undefined without a snapshot.
 */
export async function whipCountUpdatedAt(
  interactive: Pick<Interactive, "id">,
): Promise<string | undefined> {
  const snapshot = await loadSnapshot(interactive)
  return snapshot?.syncedAt ?? snapshot?.updatedAt
}
