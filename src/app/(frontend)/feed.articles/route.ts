import { type NextRequest } from "next/server"
import configPromise from "@payload-config"
import { getPayload } from "payload"
import { generateArticleFeed } from "@/utilities/generateRssFeed"
import { cache } from "react"

const queryArticles = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 20,
    overrideAccess: false,
    pagination: false,
    where: {
      _status: {
        equals: "published",
      },
    },
    sort: "-publishedAt",
  })

  return articles.docs || []
})

export async function GET(_request: NextRequest): Promise<Response> {
  const articles = await queryArticles()
  const feed = generateArticleFeed(articles)

  return new Response(feed, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=600",
    },
  })
}

export const dynamic = "force-static"
