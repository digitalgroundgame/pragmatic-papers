import configPromise from "@payload-config"
import type { Article } from "@/payload-types"
import { getPayload, type Where } from "payload"
import { cache } from "react"

const syndicated: Where = {
  and: [{ _status: { equals: "published" } }, { syndicateToSubstack: { equals: true } }],
}

export const querySyndicatedArticles = cache(async (): Promise<Article[]> => {
  const payload = await getPayload({ config: configPromise })

  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 50,
    overrideAccess: false,
    pagination: false,
    where: syndicated,
    sort: "-publishedAt",
  })

  return articles.docs
})

export const querySyndicatedArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const payload = await getPayload({ config: configPromise })

  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: { and: [syndicated, { slug: { equals: slug } }] },
  })

  return articles.docs[0] ?? null
})
