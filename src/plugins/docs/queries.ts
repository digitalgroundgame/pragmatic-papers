import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { draftMode } from "next/headers"
import { unstable_cache } from "next/cache"
import { cache } from "react"

import { DOCS_SLUG } from "./collection"
import { DOCS_CACHE_TAG } from "./revalidateDoc"

const findPublishedDocs = async () => {
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: DOCS_SLUG,
    depth: 1,
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    sort: "-publishedAt",
    select: {
      slug: true,
      title: true,
      summary: true,
      publishedAt: true,
      updatedAt: true,
      audience: true,
      heroImage: true,
    },
    // Enough of the hero image for a thumbnail.
    populate: {
      media: { alt: true, filename: true, mimeType: true, url: true, sizes: { thumbnail: true } },
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
  const payload = await getPayloadConfig()
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
