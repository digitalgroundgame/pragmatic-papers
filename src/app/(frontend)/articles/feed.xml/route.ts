import { type NextRequest } from "next/server"
import { generateArticleFeed } from "@/app/(frontend)/feeds/generateRssFeed"
import { cache } from "react"
import { getPayloadClient } from "@/data/payload"

const queryArticles = cache(async () => {
  const payload = await getPayloadClient()

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
