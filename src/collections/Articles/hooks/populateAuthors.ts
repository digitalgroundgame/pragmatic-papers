import type { Article, User } from "@/payload-types"
import type { CollectionAfterReadHook } from "payload"

// The search reindex handler fetches docs at depth: 0, leaving `authors` as
// plain IDs. This hook ensures `authors` is always populated with User
// objects so downstream consumers (e.g. beforeSync) can read `.name`.
export const populateAuthors: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead) return doc
  if (!doc.authors || !doc.authors.length) return doc
  if (doc.authors.every((a) => typeof a === "object" && a !== null)) return doc

  const authorIds = doc.authors.map((author) => (typeof author === "number" ? author : author?.id))

  if (!authorIds.length) return doc

  try {
    const { docs: authorDocs } = await payload.find({
      collection: "users",
      where: { id: { in: authorIds } },
      depth: 0,
      overrideAccess: true,
    })

    // Preserve original author order
    const authorMap = new Map(authorDocs.map((userDoc) => [userDoc.id, userDoc]))
    doc.authors = authorIds
      .map((id) => authorMap.get(id))
      .filter((userDoc): userDoc is User => Boolean(userDoc))
  } catch (error) {
    payload.logger.error(
      { err: error, authorIds, articleId: doc.id },
      "Failed to populate authors in afterRead",
    )
  }

  return doc
}
