import type { Article } from "@/payload-types"
import type { CollectionAfterReadHook } from "payload"

export const populateNarrator: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead) return doc
  if (!doc.narration) return doc

  try {
    if (typeof doc.narration === "number") {
      // Fetch with depth:1 so narrator is populated — avoids a second query
      const narrationDoc = await payload.findByID({
        id: doc.narration,
        collection: "media",
        overrideAccess: true,
        depth: 1,
      })
      const narrator = narrationDoc?.narrator
      if (narrator && typeof narrator !== "number") {
        doc.populatedNarrator = { id: narrator.id, name: narrator.name, slug: narrator.slug }
      }
    } else {
      const rawNarrator = doc.narration.narrator
      if (!rawNarrator) return doc

      if (typeof rawNarrator !== "number") {
        doc.populatedNarrator = {
          id: rawNarrator.id,
          name: rawNarrator.name,
          slug: rawNarrator.slug,
        }
      } else {
        const narratorDoc = await payload.findByID({
          id: rawNarrator,
          collection: "users",
          overrideAccess: true,
          depth: 0,
        })
        if (narratorDoc) {
          doc.populatedNarrator = {
            id: narratorDoc.id,
            name: narratorDoc.name,
            slug: narratorDoc.slug,
          }
        }
      }
    }
  } catch {
    // swallow error
  }

  return doc
}
