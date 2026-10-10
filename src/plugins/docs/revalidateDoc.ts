import { revalidatePath, revalidateTag } from "next/cache"
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Doc } from "@/payload-types"

/** The cache tag on every published-docs read: the /docs pages and the help bell. */
export const DOCS_CACHE_TAG = "docs"

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
    if (previousDoc?.slug && previousDoc.slug !== doc.slug)
      revalidatePath(`/docs/${previousDoc.slug}`)
    purgeEdgeCache(payload.logger, `doc ${doc.slug}`)
  }
  return doc
}

export const revalidateDocDelete: CollectionAfterDeleteHook<Doc> = ({
  doc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  revalidate(doc?.slug)
  purgeEdgeCache(payload.logger, `doc ${doc?.slug} deleted`)
  return doc
}
