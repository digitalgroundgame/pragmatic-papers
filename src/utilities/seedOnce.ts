import type { Payload } from "payload"

/**
 * Content a deploy seeds (a help doc, a starter page) is the site's once it arrives: editors
 * change it or delete it. These record, in Payload's key-value store, that a document was
 * seeded on this site, so a deploy that finds it gone knows an editor deleted it and leaves it
 * deleted rather than seeding it again.
 */
const seededKey = (collection: string, slug: string): string => `seeded:${collection}:${slug}`

/** Whether a deploy has seeded `slug` into `collection` on this site before. */
export const wasSeeded = (payload: Payload, collection: string, slug: string): Promise<boolean> =>
  payload.kv.has(seededKey(collection, slug))

/** Records that `slug` was seeded into `collection`, or that the site already had it. */
export const markSeeded = (payload: Payload, collection: string, slug: string): Promise<void> =>
  payload.kv.set(seededKey(collection, slug), { at: new Date().toISOString() })

/**
 * A revision of seeded content a deploy has offered a site: the hash of the repo's copy, and
 * the id of the version the deploy saved it as, if it saved one. A site that already had the
 * document when offers began records the repo's hash then, with no version.
 */
export interface OfferedRevision {
  hash: string
  version?: number | string
  at: string
}

const offeredKey = (collection: string, slug: string): string => `offered:${collection}:${slug}`

/** The revision of `slug` a deploy last offered this site, or null if it never has. */
export const lastOffered = (
  payload: Payload,
  collection: string,
  slug: string,
): Promise<OfferedRevision | null> => payload.kv.get<OfferedRevision>(offeredKey(collection, slug))

/**
 * Records that this site has been offered the revision of `slug` that hashes to `hash`, so it
 * isn't offered again: one an editor discards stays discarded.
 */
export const markOffered = (
  payload: Payload,
  collection: string,
  slug: string,
  hash: string,
  version?: number | string,
): Promise<void> =>
  payload.kv.set(offeredKey(collection, slug), {
    hash,
    ...(version === undefined ? {} : { version }),
    at: new Date().toISOString(),
  })
