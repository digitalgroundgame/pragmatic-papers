import { generateSubstackFeed } from "./generateSubstackFeed"
import { querySyndicatedArticles } from "./queries"

export async function GET(): Promise<Response> {
  const articles = await querySyndicatedArticles()

  return new Response(generateSubstackFeed(articles), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=600",
    },
  })
}

export const dynamic = "force-static"
