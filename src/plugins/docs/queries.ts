import { getPayloadClient } from "@/data/payload"
import { draftMode } from "next/headers"
import { unstable_cache } from "next/cache"
import { cache } from "react"

import { DOCS_SLUG } from "./collection"
import { DOCS_CACHE_TAG } from "./revalidateDoc"

const findPublishedDocs = async () => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: DOCS_SLUG,
    depth: 1,
    draft: false,
    // Every doc: the tree, the sidebar and the sitemap are built from this list. Payload applies
    // `limit` even with `pagination: false`; 0 lifts it.
    limit: 0,
    overrideAccess: false,
    pagination: false,
    sort: "-publishedAt",
    select: {
      slug: true,
      title: true,
      navTitle: true,
      summary: true,
      publishedAt: true,
      updatedAt: true,
      parent: true,
      _order: true,
      audience: true,
      heroImage: true,
      tour: true,
    },
    // Enough of the hero image for a thumbnail. With S3, the storage plugin builds each URL
    // from `_objectKey` (an admin upload's folder), so a select without it loses the folder.
    populate: {
      media: {
        alt: true,
        filename: true,
        mimeType: true,
        url: true,
        _objectKey: true,
        sizes: { thumbnail: true },
      },
    },
  })
  return docs
}

/** Every published doc, newest first, without its content: the /docs index, its sitemap and the bell (with each hero image's thumbnail). */
export const queryPublishedDocs = (): ReturnType<typeof findPublishedDocs> =>
  unstable_cache(findPublishedDocs, ["docs-published"], {
    tags: [DOCS_CACHE_TAG],
  })()

const findDoc = async (slug: string, draft: boolean) => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: DOCS_SLUG,
    depth: 2,
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: { slug: { equals: slug } },
  })
  return docs[0] ?? null
}

const findPublishedDoc = (slug: string) =>
  unstable_cache(() => findDoc(slug, false), ["doc", slug], {
    tags: [DOCS_CACHE_TAG],
  })()

/** One doc with its media; cached until a doc is saved, except in a draft preview. */
export const queryDocBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()
  return draft ? findDoc(slug, true) : findPublishedDoc(slug)
})
