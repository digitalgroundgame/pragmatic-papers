import { revalidatePath, revalidateTag } from "next/cache"
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Doc } from "@/payload-types"

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

export const revalidateDoc: CollectionAfterChangeHook<Doc> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  if (doc._status === "published" || previousDoc?._status === "published") {
    revalidate(doc.slug)
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) {
      revalidatePath(`/docs/${previousDoc.slug}`)
    }
    purgeEdgeCache(payload.logger, `doc ${doc.slug}`, { paths: DOCS_PATHS })
  }
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
