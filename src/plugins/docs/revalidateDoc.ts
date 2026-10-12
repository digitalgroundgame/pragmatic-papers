import { revalidatePath, revalidateTag } from "next/cache"
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Doc } from "@/payload-types"

/** The cache tag on every published-docs read: the /docs pages and the help bell. */
export const DOCS_CACHE_TAG = "docs"

/** The pages the `docs` tag reaches, beside each doc's own: the Worker purges them too. */
const DOCS_LISTINGS = ["/docs", "/docs/whats-new", "/docs/sitemap.xml"]

const revalidate = (slug: string | null | undefined): string[] => {
  revalidateTag(DOCS_CACHE_TAG, "max")
  revalidatePath("/docs")
  if (slug) revalidatePath(`/docs/${slug}`)
  return slug ? [...DOCS_LISTINGS, `/docs/${slug}`] : [...DOCS_LISTINGS]
}

export const revalidateDoc: CollectionAfterChangeHook<Doc> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  if (doc._status === "published" || previousDoc?._status === "published") {
    const paths = revalidate(doc.slug)
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) {
      revalidatePath(`/docs/${previousDoc.slug}`)
      paths.push(`/docs/${previousDoc.slug}`)
    }
    purgeEdgeCache(payload.logger, `doc ${doc.slug}`, { paths })
  }
  return doc
}

export const revalidateDocDelete: CollectionAfterDeleteHook<Doc> = ({
  doc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  purgeEdgeCache(payload.logger, `doc ${doc?.slug} deleted`, { paths: revalidate(doc?.slug) })
  return doc
}
