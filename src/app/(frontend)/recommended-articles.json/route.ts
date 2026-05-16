import type { Article, Media } from "@/payload-types"
import configPromise from "@payload-config"
import { type NextRequest } from "next/server"
import { getPayload } from "payload"

export interface RecommendedArticleCandidate {
  slug: string
  title: string
  metaImage: (Media & { mimeType: `image/${string}` }) | null
  metaDescription: string | null
  publishedAt: string | null
  engagementScore: number
}

export async function GET(_request: NextRequest): Promise<Response> {
  const payload = await getPayload({ config: configPromise })
  const recommendations = await payload.findGlobal({
    slug: "article-recommendations",
    depth: 2,
  })

  const candidates: RecommendedArticleCandidate[] = (recommendations?.rankings ?? [])
    .filter((r): r is typeof r & { article: Article } => typeof r.article === "object")
    .map((r) => {
      const article = r.article
      const metaImage = article.meta?.image
      return {
        slug: article.slug ?? "",
        title: article.title,
        metaImage:
          typeof metaImage === "object" && metaImage !== null
            ? (metaImage as Media & { mimeType: `image/${string}` })
            : null,
        metaDescription: article.meta?.description ?? null,
        publishedAt: article.publishedAt ?? null,
        engagementScore: r.engagementScore,
      }
    })

  return Response.json(
    { candidates },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}

export const dynamic = "force-dynamic"
