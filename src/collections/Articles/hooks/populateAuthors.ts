import type { Article, User } from "@/payload-types"
import type { CollectionAfterReadHook } from "payload"

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// GraphQL will not return mutated user data that differs from the underlying schema
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead) return doc
  if (!doc.authors || !doc.authors.length) return doc

  const authorIds = doc.authors.map((author) =>
    typeof author === "number" ? author : author?.id,
  )

  if (!authorIds.length) return doc

  try {
    const { docs: authorDocs } = await payload.find({
      collection: "users",
      where: { id: { in: authorIds } },
      overrideAccess: true,
      depth: 1,
    })

    // Preserve original author order
    const authorMap = new Map(authorDocs.map((userDoc) => [userDoc.id, userDoc]))
    const populatedAuthors = authorIds
      .map((id) => authorMap.get(id))
      .filter((userDoc): userDoc is User => Boolean(userDoc))

    if (populatedAuthors.length < authorIds.length) {
      const missingIds = authorIds.filter((id) => !authorMap.has(id))
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
      payload.logger.debug(
        { articleId: doc.id, count: populatedAuthors.length },
        `Populated authors for article ${doc.id}`,
      )
    }
  } catch (error) {
    payload.logger.error({ err: error, authorIds, articleId: doc.id }, "Failed to populate authors")
  }

  return doc
}
