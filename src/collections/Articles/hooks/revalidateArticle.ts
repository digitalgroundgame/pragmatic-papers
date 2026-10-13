import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Article } from "@/payload-types"
import { readersChange, type ReadersCopy } from "@/utilities/readersCopy"

const revalidateDoc = async (givenDoc: ReadersCopy, payload: Payload) => {
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

export const revalidateArticle: CollectionAfterChangeHook<Article> = async (args) => {
  const { doc, req } = args
  if (req.context.disableRevalidate) return doc
  const change = await readersChange(args)
  if (!change) return doc
  const { before, after } = change
  if (after) await revalidateDoc(after, req.payload)
  // Unpublished or renamed: its old paths are still cached, including the Substack import
  // URL an editor may already have copied.
  if (before && (!after || before.slug !== after.slug)) await revalidateDoc(before, req.payload)
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
