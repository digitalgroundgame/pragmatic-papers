import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"
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

  for (const volume of volumes.docs) paths.push(`/volumes/${volume.slug}`)

  // The sitemap and the listings render per request here; `shared` covers them on the Worker,
  // and revalidates the home page, which is prerendered.
  revalidateForReaders(payload.logger, `article ${givenDoc.slug}`, {
    paths,
    tags: ["articles-sitemap"],
    shared: true,
  })
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
