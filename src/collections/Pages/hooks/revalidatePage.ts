import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Page } from "../../../payload-types"

export const revalidatePage: CollectionAfterChangeHook<Page> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  if (doc._status === "published") {
    const path = doc.slug === "home" ? "/" : `/${doc.slug}`

    payload.logger.info(`Revalidating page at path: ${path}`)
    if (doc.slug === "/home") {
      revalidatePath(doc.slug)
    }
    revalidatePath(path)
    revalidateTag("pages-sitemap", "max")
    purgeEdgeCache(payload.logger, `page ${doc.slug}`)
  }

  // If the page was previously published, we need to revalidate the old path
  if (previousDoc?._status === "published" && doc._status !== "published") {
    const oldPath = previousDoc.slug === "home" ? "/" : `/${previousDoc.slug}`

    payload.logger.info(`Revalidating old page at path: ${oldPath}`)

    revalidatePath(oldPath)
    revalidateTag("pages-sitemap", "max")
    purgeEdgeCache(payload.logger, `page ${previousDoc.slug} unpublished`)
  }

  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    const path = doc?.slug === "home" ? "/" : `/${doc?.slug}`
    revalidatePath(path)
    revalidateTag("pages-sitemap", "max")
    purgeEdgeCache(payload.logger, `page ${doc?.slug} deleted`)
  }

  return doc
}
