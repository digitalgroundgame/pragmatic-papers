import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"
import type { Doc } from "@/payload-types"
import { readersChange } from "@/utilities/readersCopy"

/** The cache tag on every published-docs read: the /docs pages and the help bell. */
export const DOCS_CACHE_TAG = "docs"

/**
 * Revalidates /docs and the `docs` tag, and the Worker purges every page under /docs (purging
 * `/docs` takes them all): each page's sidebar and Previous and Next links read every published
 * doc, and moving or renaming one changes the address of every doc under it.
 */
export const revalidateDocs = (
  logger: Parameters<typeof revalidateForReaders>[0],
  reason: string,
): void => {
  revalidateForReaders(logger, reason, { paths: ["/docs"], tags: [DOCS_CACHE_TAG] })
}

export const revalidateDoc: CollectionAfterChangeHook<Doc> = async (args) => {
  const { doc, req } = args
  if (req.context.disableRevalidate) return doc
  if (!(await readersChange(args))) return doc
  revalidateDocs(req.payload.logger, `doc ${doc.slug}`)
  return doc
}

export const revalidateDocDelete: CollectionAfterDeleteHook<Doc> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) revalidateDocs(payload.logger, `doc ${doc?.slug} deleted`)
  return doc
}
