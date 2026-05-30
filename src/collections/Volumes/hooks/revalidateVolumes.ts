import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import type { Article } from "@/payload-types"

export const revalidateArticle: CollectionAfterChangeHook<Article> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === "published") {
      const path = `/volumes/${doc.slug}`

      payload.logger.info(`Revalidating article at path: ${path}`)

      revalidatePath(path)
      revalidatePath("/feed.volumes")
      revalidateTag("volumes-sitemap", "max")
    }

    // If the article was previously published, we need to revalidate the old path
    if (previousDoc._status === "published" && doc._status !== "published") {
      const oldPath = `/volumes/${previousDoc.slug}`

      payload.logger.info(`Revalidating old article at path: ${oldPath}`)

      revalidatePath(oldPath)
      revalidatePath("/feed.volumes")
      revalidateTag("volumes-sitemap", "max")
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Article> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    const path = `/volumes/${doc?.slug}`

    revalidatePath(path)
    revalidatePath("/feed.volumes")
    revalidateTag("volumes-sitemap", "max")
  }

  return doc
}
