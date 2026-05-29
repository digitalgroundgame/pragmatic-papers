import type { Article, User } from "@/payload-types"
import { getRequestLoader } from "@/utilities/requestLoader"
import type { CollectionAfterReadHook } from "payload"

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// GraphQL will not return mutated user data that differs from the underlying schema
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
//
// Lookups are coalesced per-request via getRequestLoader, so populating N articles
// hits the users table once instead of N times.
export const populateAuthors: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead) return doc
  if (!doc.authors || !doc.authors.length) return doc

  const authorIds = doc.authors.map((author) => (typeof author === "number" ? author : author?.id))

  if (!authorIds.length) return doc

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

  try {
    const users = await Promise.all(authorIds.map((id) => loadUser(id)))
    const populatedAuthors = users.filter((u): u is User => Boolean(u))

    if (populatedAuthors.length < authorIds.length) {
      const missingIds = authorIds.filter((_, i) => !users[i])
      payload.logger.warn(
        { articleId: doc.id, missingIds },
        `Some authors were not found for article ${doc.id}`,
      )
    }

    if (populatedAuthors.length > 0) {
      doc.populatedAuthors = populatedAuthors.map((populatedAuthor) => ({
        id: populatedAuthor.id,
        name: populatedAuthor.name,
        slug: populatedAuthor.slug,
        affiliation: populatedAuthor.affiliation,
        biography: populatedAuthor.biography,
        profileImage: populatedAuthor.profileImage,
        socials: populatedAuthor.socials,
      }))
    }
  } catch (error) {
    payload.logger.error({ err: error, authorIds, articleId: doc.id }, "Failed to populate authors")
  }

  return doc
}
