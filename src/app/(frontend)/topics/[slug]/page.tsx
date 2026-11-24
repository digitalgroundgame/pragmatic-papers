import { MediaRow, MediaRowList } from "@/components/MediaRow"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Pagination } from "@/components/Pagination"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import type { User, Volume } from "@/payload-types"
import { generateMeta, paginatedPath } from "@/utilities/generateMeta"
import { queryTopicBySlug, queryVolumesForArticles } from "@/data/queries"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import React, { cache } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { PageHeader, PageShell } from "@/components/PageShell"
import {
  ContributorsPanel,
  MostReadPanel,
  NewsletterPanel,
  RelatedTopicsPanel,
  WithAside,
} from "@/components/Aside"
import { isResolved, relationshipId } from "@/utilities/relationships"
import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { getPayloadClient } from "@/data/payload"

interface Args {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    p?: string
  }>
}

// Paginated with `?p=`, which only a request carries, so this is rendered per request. That's
// also why there's no generateStaticParams: a prerendered slug would never be served.
export const dynamic = "force-dynamic"

const ARTICLES_PER_PAGE = 5
const queryArticlesByTopic = cache(async (topicId: number, page: number = 1) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayloadClient()

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

export async function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  const { slug = "" } = await params
  const { p } = await searchParams
  const topic = await queryTopicBySlug(slug)

  return generateMeta({ doc: topic, canonicalPath: paginatedPath(`/topics/${slug}`, p) })
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
  // A page past the last one would be an empty listing that names itself as canonical.
  if (page > 1 && page > totalPages) notFound()
  const articleIds = articles.map((article) => article.id).filter(Boolean)
  const volumes = await queryVolumesForArticles(articleIds)

  const volumeByArticleId = new Map<number, Volume>()

  for (const volume of volumes) {
    const volumeArticles = volume.articles || []
    for (const articleRef of volumeArticles) {
      const articleId = relationshipId(articleRef)

      if (articleId != null && !volumeByArticleId.has(articleId)) {
        volumeByArticleId.set(articleId, volume)
      }
    }
  }

  return (
    <>
      <Breadcrumbs
        shell
        items={[
          { name: "Topics", path: "/topics" },
          { name: topic.name, path: url },
        ]}
      />
      <PageShell>
        <PayloadRedirects disableNotFound url={url} />

        {draft && <LivePreviewListener />}

        <PageHeader title={topic.name} description={topic.description} />

        <WithAside
          aside={
            <>
              <MostReadPanel topicId={topic.id} />
              <ContributorsPanel topicId={topic.id} />
              <RelatedTopicsPanel topicId={topic.id} />
              <NewsletterPanel />
            </>
          }
        >
          <section aria-label="Articles for this topic">
            <h2 className="sr-only">Articles</h2>
            {totalDocs === 0 ? (
              <p className="text-muted-foreground text-sm">No articles found for this topic yet.</p>
            ) : (
              <>
                <MediaRowList>
                  {articles.map((article) => {
                    const volume = volumeByArticleId.get(article.id)
                    return (
                      <MediaRow
                        key={article.id}
                        href={`/articles/${article.slug}`}
                        title={article.title}
                        summary={article.meta?.description}
                        image={article.meta?.image}
                        meta={volume?.title}
                        byline={
                          <Byline
                            authors={(article.authors ?? [])
                              .filter(isResolved<User>)
                              .map(toBylineAuthor)}
                          />
                        }
                      />
                    )
                  })}
                </MediaRowList>
                <Pagination page={currentPage} totalPages={totalPages} />
              </>
            )}
          </section>
        </WithAside>
      </PageShell>
    </>
  )
}
