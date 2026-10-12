import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Article } from "@/payload-types"

const revalidateDoc = async (givenDoc: Article, payload: Payload) => {
  const path = `/articles/${givenDoc.slug}`
  const paths = [
    path,
    "/articles/feed.xml",
    "/articles/substack.xml",
    `/articles/${givenDoc.slug}/substack.xml`,
  ]

  payload.logger.info(`Revalidating article at path: ${path}`)
  for (const changed of paths) revalidatePath(changed)
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
    paths.push(volumePath)
  })

  // The sitemap and the listings render per request here; `shared` covers them on the Worker.
  purgeEdgeCache(payload.logger, `article ${givenDoc.slug}`, { paths, shared: true })
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

    // A renamed published article leaves its old paths cached, including the
    // Substack import URL an editor may already have copied.
    if (
      doc._status === "published" &&
      previousDoc?._status === "published" &&
      previousDoc.slug !== doc.slug
    ) {
      await revalidateDoc(previousDoc, payload)
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
