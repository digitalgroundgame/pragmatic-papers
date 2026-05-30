import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import type { Article } from "../../../payload-types"

const revalidateDoc = async (givenDoc: Article, payload: Payload) => {
  const path = `/articles/${givenDoc.slug}`

  payload.logger.info(`Revalidating article at path: ${path}`)
  revalidatePath(path)
  revalidatePath("/feed.articles")
  revalidateTag("articles-sitemap", "max")

  // Find and revalidate all volumes that reference this article
  const volumes = await payload.find({
    collection: "volumes",
    where: {
      "articles.id": {
        equals: givenDoc.id,
      },
    },
    select: {
      slug: true,
    },
    depth: 0,
  })

  volumes.docs.forEach((volume) => {
    const volumePath = `/volumes/${volume.slug}`
    payload.logger.info(`Revalidating volume at path: ${volumePath}`)
    revalidatePath(volumePath)
  })
}

export const revalidateArticle: CollectionAfterChangeHook<Article> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === "published") {
      await revalidateDoc(doc, payload)
    }

    // If the article was previously published, we need to revalidate the old path
    if (previousDoc._status === "published" && doc._status !== "published") {
      await revalidateDoc(previousDoc, payload)
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    await revalidateDoc(doc, payload)
  }

  return doc
}
