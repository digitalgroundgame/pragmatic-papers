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
