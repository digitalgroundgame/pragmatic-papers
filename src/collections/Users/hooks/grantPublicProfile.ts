import type { CollectionAfterChangeHook, PayloadRequest, TypeWithID } from "payload"

type UserRef = number | { id: number } | null | undefined

/**
 * Sets `publicProfile` on every credited user that doesn't have it yet. Runs in the
 * saving document's transaction (`req`) and skips the users already marked, so a save
 * that credits no one new writes nothing.
 */
async function markPublic(refs: UserRef[], req: PayloadRequest): Promise<void> {
  const ids = refs
    .map((ref) => (typeof ref === "object" && ref !== null ? ref.id : ref))
    .filter((id): id is number => id != null)
  if (ids.length === 0) return

  await req.payload.update({
    collection: "users",
    where: { id: { in: ids }, publicProfile: { not_equals: true } },
    data: { publicProfile: true },
    depth: 0,
    overrideAccess: true,
    req,
  })
}

/**
 * Builds an `afterChange` hook that gives the users a document credits (an article's
 * authors, a narration's narrator) a public profile. Their byline links to
 * `/authors/<slug>`, and `publicProfile` keeps that page readable after a role change
 * takes their staff role away.
 */
export const grantPublicProfile =
  <T extends TypeWithID>(credited: (doc: T) => UserRef | UserRef[]): CollectionAfterChangeHook<T> =>
  async ({ doc, req }) => {
    const refs = credited(doc)
    await markPublic(Array.isArray(refs) ? refs : [refs], req)
    return doc
  }
