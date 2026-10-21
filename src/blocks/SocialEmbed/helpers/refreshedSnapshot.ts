import { cache } from "react"

import { embedKey, type EmbedIdentity } from "@/blocks/SocialEmbed/helpers/embedKey"
import { getPayloadClient } from "@/data/payload"
import type { SocialEmbedSnapshot } from "@/payload-types"

const findRefreshed = cache(async (key: string): Promise<SocialEmbedSnapshot | null> => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "embed-snapshots",
    where: { key: { equals: key } },
    limit: 1,
    depth: 0,
    pagination: false,
    select: { snapshot: true },
  })
  return docs[0]?.snapshot ?? null
})

/**
 * The snapshot the daily refresh last fetched for this embed, or null when it hasn't run for
 * it. Only reads: a page render never writes to the database.
 */
export async function findRefreshedSnapshot(
  embed: EmbedIdentity,
): Promise<SocialEmbedSnapshot | null> {
  try {
    return await findRefreshed(embedKey(embed))
  } catch {
    // The saved snapshot still renders the embed; a failed lookup only loses a refresh.
    return null
  }
}
