import type { Article, User } from "@/payload-types"
import type { CollectionAfterReadHook, SelectType } from "payload"

/**
 * Public-safe subset of the `users` collection.
 *
 * This hook fetches with `overrideAccess: true` (see below), which skips
 * field-level read access, and collection `afterRead` hooks run *after*
 * Payload has sanitized the document's fields — so anything written back into
 * `doc.authors` is serialized to the client verbatim. Selecting explicitly
 * keeps `email` and `roles` (guarded by `selfOrAdminFieldLevel`) out of
 * publicly readable article responses.
 *
 * Allow-list, not a deny-list: a new private field on `users` must be opted in
 * here before it can ever reach a byline.
 */
const PUBLIC_AUTHOR_FIELDS = {
  name: true,
  slug: true,
  affiliation: true,
  biography: true,
  profileImage: true,
  socials: true,
} satisfies SelectType

// The search reindex handler fetches docs at depth: 0, leaving `authors` as
// plain IDs. This hook ensures `authors` is always populated with User
// objects so downstream consumers (e.g. beforeSync) can read `.name`.
export const populateAuthors: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead) return doc
  if (!doc.authors || !doc.authors.length) return doc

  // Only the entries Payload left as bare IDs need resolving. Authors it
  // already populated have been through field-level access and must not be
  // overwritten with the `overrideAccess: true` docs fetched here.
  const unresolvedIds = doc.authors.filter((author): author is number => typeof author === "number")

  if (!unresolvedIds.length) return doc

  try {
    const { docs: authorDocs } = await payload.find({
      collection: "users",
      where: { id: { in: unresolvedIds } },
      depth: 0,
      limit: unresolvedIds.length,
      overrideAccess: true,
      select: PUBLIC_AUTHOR_FIELDS,
    })

    const authorMap = new Map(authorDocs.map((userDoc) => [userDoc.id, userDoc as User]))

    // Preserve original author order, and drop IDs that no longer resolve.
    doc.authors = doc.authors
      .map((author) => (typeof author === "number" ? authorMap.get(author) : author))
      .filter((author): author is User => Boolean(author))
  } catch (error) {
    payload.logger.error(
      { err: error, authorIds: unresolvedIds, articleId: doc.id },
      "Failed to populate authors in afterRead",
    )
  }

  return doc
}
