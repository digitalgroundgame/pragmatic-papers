import type { Article } from "@/payload-types"
import { getPayloadClient } from "@/data/payload"
import type { Where } from "payload"
import { cache } from "react"

const syndicated: Where = {
  and: [{ _status: { equals: "published" } }, { syndicateToSubstack: { equals: true } }],
}

/**
 * Not yet recorded as a post on Substack. An empty string counts: clearing the field in the
 * admin can save one.
 */
const notImported: Where = {
  or: [{ substackUrl: { exists: false } }, { substackUrl: { equals: "" } }],
}

/**
 * The bulk feed: every syndicated article Substack hasn't imported yet, so importing it again
 * doesn't repeat posts. An article with a Substack post URL stays in its own feed
 * (`querySyndicatedArticleBySlug`), for a deliberate re-import.
 */
export const querySyndicatedArticles = cache(async (): Promise<Article[]> => {
  const payload = await getPayloadClient()

  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 0,
    overrideAccess: false,
    pagination: false,
    where: { and: [syndicated, notImported] },
    sort: "-publishedAt",
  })

  return articles.docs
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

  return articles.docs[0] ?? null
})
