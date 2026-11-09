import { attachMapImages } from "@/blocks/InteractiveMap/feedImage"
import type { Article } from "@/payload-types"
import { getPayloadClient } from "@/data/payload"
import type { Payload, Where } from "payload"
import { cache } from "react"

const syndicated: Where = {
  and: [{ _status: { equals: "published" } }, { syndicateToSubstack: { equals: true } }],
}

/**
 * The articles with each interactive map's stored picture attached, which the feed shows
 * in the map's place. A failed lookup leaves the feed its link back to the article.
 */
async function withMapImages(payload: Payload, articles: Article[]): Promise<Article[]> {
  try {
    await attachMapImages(payload, articles)
  } catch (error) {
    payload.logger.error({ err: error, msg: "Could not look up the Substack feed's map images" })
  }
  return articles
}

export const querySyndicatedArticles = cache(async (): Promise<Article[]> => {
  const payload = await getPayloadClient()

  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 0,
    overrideAccess: false,
    pagination: false,
    where: syndicated,
    sort: "-publishedAt",
  })

  return withMapImages(payload, articles.docs)
})

export const querySyndicatedArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const payload = await getPayloadClient()

  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: { and: [syndicated, { slug: { equals: slug } }] },
  })

  const [article] = await withMapImages(payload, articles.docs)
  return article ?? null
})
