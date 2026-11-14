import { draftMode } from "next/headers"
import { cache } from "react"

import { getPayloadClient } from "@/data/payload"
import type { Interactive } from "@/payload-types"
import { failure, type Result } from "@/utilities/result"

import { parseWhipCount, type WhipCountData } from "./model"

/**
 * A whip count interactive's count: its published snapshot, or the newest draft in preview.
 * Not cached across requests: the page renders per request and the edge holds its copy.
 */
export const loadWhipCount = cache(
  async (interactive: Pick<Interactive, "id">): Promise<Result<WhipCountData, string>> => {
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
    const snapshot = docs[0]
    if (!snapshot) return failure("no count has been pushed to it yet")
    return parseWhipCount(snapshot.data)
  },
)
