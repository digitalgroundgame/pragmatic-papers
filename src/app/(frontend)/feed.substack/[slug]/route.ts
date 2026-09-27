import { generateSubstackFeed } from "../generateSubstackFeed"
import { querySyndicatedArticleBySlug, querySyndicatedArticles } from "../queries"

interface Args {
  params: Promise<{ slug: string }>
}

/**
 * A feed holding one article, so an editor can import exactly that post into
 * Substack without re-importing everything else in `/feed.substack`.
 */
export async function GET(_request: Request, { params }: Args): Promise<Response> {
  const { slug } = await params
  const article = await querySyndicatedArticleBySlug(decodeURIComponent(slug))

  if (!article) {
    return new Response("Not found", { status: 404 })
  }

  return new Response(generateSubstackFeed([article]), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=600",
    },
  })
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const articles = await querySyndicatedArticles()
  return articles.map(({ slug }) => ({ slug }))
}

export const dynamic = "force-static"
