import { cache } from "react"

import { getPayloadClient } from "@/data/payload"

/**
 * Whether readers can see the article: published, read without staff access. The same check
 * the comments endpoint makes before taking a comment, so preview shows comments exactly where
 * they can be posted, even when the version being previewed is a newer draft.
 */
export const isArticlePublished = cache(async (id: number): Promise<boolean> => {
  const payload = await getPayloadClient()
  const article = await payload.findByID({
    collection: "articles",
    id,
    depth: 0,
    draft: false,
    overrideAccess: false,
    disableErrors: true,
    select: {},
  })
  return Boolean(article)
})
