import { revalidatePath, revalidateTag } from "next/cache"
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Doc } from "@/payload-types"
import { readersChange } from "@/utilities/readersCopy"

/** The cache tag on every published-docs read: the /docs pages and the help bell. */
export const DOCS_CACHE_TAG = "docs"

/**
 * What the Worker purges for a doc save: every page under /docs, since each one's sidebar
 * and Previous and Next links read every published doc (the `docs` tag).
 */
const DOCS_PATHS = ["/docs"]

const revalidate = (slug: string | null | undefined): void => {
  revalidateTag(DOCS_CACHE_TAG, "max")
  revalidatePath("/docs")
  if (slug) revalidatePath(`/docs/${slug}`)
}

export const revalidateDoc: CollectionAfterChangeHook<Doc> = async (args) => {
  const { doc, req } = args
  if (req.context.disableRevalidate) return doc
  const change = await readersChange(args)
  if (!change) return doc
  revalidate(doc.slug)
  const { before } = change
  if (before?.slug && before.slug !== doc.slug) revalidatePath(`/docs/${before.slug}`)
  purgeEdgeCache(req.payload.logger, `doc ${doc.slug}`, { paths: DOCS_PATHS })
  return doc
}

export const revalidateDocDelete: CollectionAfterDeleteHook<Doc> = ({
  doc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  revalidate(doc?.slug)
  purgeEdgeCache(payload.logger, `doc ${doc?.slug} deleted`, { paths: DOCS_PATHS })
  return doc
}
