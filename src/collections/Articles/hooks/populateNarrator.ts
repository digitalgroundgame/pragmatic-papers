import type { Article, Media, User } from "@/payload-types"
import { getRequestLoader } from "@/utilities/requestLoader"
import type { CollectionAfterReadHook } from "payload"

// Coalesces per-request user/media lookups so populating N articles hits each
// table once instead of N times. Shares the user loader with populateAuthors.
export const populateNarrator: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead) return doc
  if (!doc.narration) return doc

  const loadUser = getRequestLoader<number, User>(context, "__articleAuthorLoader", async (ids) => {
    const { docs } = await payload.find({
      collection: "users",
      where: { id: { in: ids } },
      overrideAccess: true,
      depth: 1,
      limit: ids.length,
      pagination: false,
    })
    return new Map(docs.map((u) => [u.id, u]))
  })

  const loadMedia = getRequestLoader<number, Media>(
    context,
    "__articleNarrationMediaLoader",
    async (ids) => {
      const { docs } = await payload.find({
        collection: "media",
        where: { id: { in: ids } },
        overrideAccess: true,
        depth: 0,
        limit: ids.length,
        pagination: false,
      })
      return new Map(docs.map((m) => [m.id, m]))
    },
  )

  try {
    let narratorId: number | undefined
    let narratorObj: User | undefined

    if (typeof doc.narration === "number") {
      const media = await loadMedia(doc.narration)
      const raw = media?.narrator
      if (typeof raw === "number") narratorId = raw
      else if (raw) narratorObj = raw as User
    } else {
      const raw = doc.narration.narrator
      if (typeof raw === "number") narratorId = raw
      else if (raw) narratorObj = raw
    }

    if (!narratorObj && narratorId !== undefined) {
      narratorObj = await loadUser(narratorId)
    }

    if (narratorObj) {
      doc.populatedNarrator = {
        id: narratorObj.id,
        name: narratorObj.name,
        slug: narratorObj.slug,
      }
    }
  } catch {
    // swallow error — keep prior behavior of silently no-oping
  }

  return doc
}
