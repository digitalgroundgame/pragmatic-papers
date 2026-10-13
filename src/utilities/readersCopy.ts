import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionSlug,
  PayloadRequest,
} from "payload"

/** The fields of a document that decide where readers find it, and whether they can. */
export interface ReadersCopy {
  id: number | string
  slug?: string | null
  _status?: "draft" | "published" | null
}

/** Whether a reader can see it: published, or in a collection without drafts. */
export const isVisible = (doc?: Omit<ReadersCopy, "id"> | null): boolean =>
  doc != null && (doc._status == null || doc._status === "published")

const contextKey = (collection: string, id: number | string): string =>
  `readersCopy:${collection}:${id}`

async function readersCopyOf(
  req: PayloadRequest,
  collection: CollectionSlug,
  id: number | string,
): Promise<ReadersCopy | null> {
  try {
    // `draft: false` reads the collection's own row, which a draft save leaves alone: the
    // copy readers are served, rather than the latest version an autosave wrote.
    const doc = await req.payload.findByID({
      collection,
      id,
      draft: false,
      depth: 0,
      req,
      overrideAccess: true,
      select: { slug: true, _status: true },
    })
    return doc as unknown as ReadersCopy
  } catch {
    return null
  }
}

/**
 * Remembers the copy readers see before a save, for `readersChange` to compare after it.
 * Payload hands `afterChange` the latest version as `previousDoc`, and once an editor has
 * typed into a published document that is an autosaved draft, not what readers see.
 * Register it in `beforeChange` on every collection with drafts whose hooks use
 * `readersChange`.
 */
export const rememberReadersCopy: CollectionBeforeChangeHook = async ({
  collection,
  data,
  operation,
  originalDoc,
  req,
}) => {
  const id = (originalDoc as Partial<ReadersCopy> | undefined)?.id
  if (operation !== "update" || !collection.versions?.drafts || id == null) return data
  if (req.context.disableRevalidate) return data
  const copy = await readersCopyOf(req, collection.slug, id)
  // Set after the read: a Local API call with `req` swaps `req.context` for a copy.
  req.context[contextKey(collection.slug, id)] = { copy }
  return data
}

/** What readers saw before a save and see after it; null for a copy they can't see. */
export interface ReadersChange {
  before: ReadersCopy | null
  after: ReadersCopy | null
}

/**
 * How a save changed what readers see, or null when it changed nothing they can see: a
 * draft saved over a published copy (an autosave), or a draft of something never published.
 * Without `rememberReadersCopy` registered, `before` falls back to `previousDoc`.
 */
export async function readersChange({
  collection,
  doc,
  previousDoc,
  req,
}: Pick<
  Parameters<CollectionAfterChangeHook>[0],
  "collection" | "doc" | "previousDoc" | "req"
>): Promise<ReadersChange | null> {
  const next = doc as ReadersCopy
  // On create Payload hands an empty `previousDoc`: there was nothing for readers to see.
  const prev =
    (previousDoc as ReadersCopy | undefined)?.id == null ? null : (previousDoc as ReadersCopy)
  const shown = (copy?: ReadersCopy | null) => (copy && isVisible(copy) ? copy : null)
  if (!collection.versions?.drafts) return { before: shown(prev), after: shown(next) }

  const remembered = req.context[contextKey(collection.slug, next.id)] as
    { copy: ReadersCopy | null } | undefined
  const before = shown(remembered ? remembered.copy : prev)
  // A draft leaves readers' copy alone unless it unpublished it, which only the row can say.
  const after = isVisible(next) ? next : shown(await readersCopyOf(req, collection.slug, next.id))
  if (!isVisible(next) && after) return null
  if (!before && !after) return null
  return { before, after }
}
