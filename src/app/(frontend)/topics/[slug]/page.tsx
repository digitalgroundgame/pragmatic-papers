import { AuthorArticleCard } from "@/components/Articles/AuthorArticleCard"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Pagination } from "@/components/Pagination"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import type { Volume } from "@/payload-types"
import { generateMeta } from "@/utilities/generateMeta"
import { queryTopicBySlug, queryVolumesForArticles } from "@/utilities/queries"
import config from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React, { cache } from "react"

interface Args {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    p?: string
  }>
}

export async function generateStaticParams(): Promise<{ slug: string | null | undefined }[]> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: "topics",
    draft: false,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    where: {
      slug: {
        not_equals: null,
      },
    },
  })

  return docs.map(({ slug }) => ({ slug }))
}

const ARTICLES_PER_PAGE = 5
const queryArticlesByTopic = cache(async (topicId: number, page: number = 1) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config })

  return await payload.find({
    collection: "articles",
    draft,
    limit: ARTICLES_PER_PAGE,
    page,
    overrideAccess: draft,
    where: {
      topics: {
        equals: topicId,
      },
    },
    depth: 2,
  })
})

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug = "" } = await params
  const topic = await queryTopicBySlug(slug)

  return generateMeta({ doc: topic, canonicalPath: `/topics/${slug}` })
}

export default async function TopicPage({
  params: params,
  searchParams,
}: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug = "" } = await params
  const { p } = await searchParams
  let page = Number(p) || 1
  if (!Number.isInteger(page) || page < 1) page = 1

  const url = `/topics/${slug}`
  const topic = await queryTopicBySlug(slug)

  if (!topic) return <PayloadRedirects url={url} />

  const {
    docs: articles,
    totalDocs,
    totalPages,
    page: currentPage,
  } = await queryArticlesByTopic(topic.id, page)
  const articleIds = articles.map((article) => article.id).filter(Boolean)
  const volumes = await queryVolumesForArticles(articleIds)

  const volumeByArticleId = new Map<number, Volume>()

  for (const volume of volumes) {
    const volumeArticles = volume.articles || []
    for (const articleRef of volumeArticles) {
      const articleId =
        typeof articleRef === "object" && articleRef !== null
          ? articleRef.id
          : (articleRef as number | undefined)

      if (articleId != null && !volumeByArticleId.has(articleId)) {
        volumeByArticleId.set(articleId, volume)
      }
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4">
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <header className="space-y-3">
        <h1>{topic.name}</h1>
        {topic.description && <p className="text-muted-foreground text-sm">{topic.description}</p>}
      </header>

      <section aria-label="Articles for this topic">
        <h2 className="mb-3">Articles</h2>
        {totalDocs === 0 ? (
          <p className="text-muted-foreground text-sm">No articles found for this topic yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {articles.map((article) => {
                const volume = volumeByArticleId.get(article.id)
                return <AuthorArticleCard key={article.id} article={article} volume={volume} />
              })}
            </div>
            {totalPages > 1 && currentPage && (
              <Pagination page={currentPage} totalPages={totalPages} />
            )}
          </>
        )}
      </section>
    </article>
  )
}
