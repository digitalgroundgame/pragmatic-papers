import { draftMode } from "next/headers"
import { cache } from "react"
import { getPayloadClient } from "@/data/payload"

export const ARTICLES_PER_PAGE = 5

/**
 * One page of the articles crediting `userId`. Outside draft mode it runs
 * with the reader's access, so a draft that was never published stays off the page.
 */
export const queryArticlesByAuthor = cache(async (userId: number, page: number = 1) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayloadClient()

  return payload.find({
    collection: "articles",
    draft,
    overrideAccess: draft,
    limit: ARTICLES_PER_PAGE,
    page,
    where: {
      authors: {
        equals: userId,
      },
    },
    depth: 2,
  })
})
