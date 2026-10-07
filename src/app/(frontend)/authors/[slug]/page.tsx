import { AuthorArticleCard } from "@/components/Articles/AuthorArticleCard"
import { AuthorLinks } from "@/components/Authors/AuthorLinks"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Media } from "@/components/Media"
import { PageRange } from "@/components/PageRange"
import { Pagination } from "@/components/Pagination"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import RichText from "@/components/RichText"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import type { Article as ArticleType, Volume } from "@/payload-types"
import { getInitials } from "@/utilities/getInitials"
import { isResolved } from "@/utilities/relationships"
import { getMediaUrl } from "@/utilities/getMediaUrl"
import { paginatedPath } from "@/utilities/generateMeta"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { queryUserBySlug, queryVolumesForArticles } from "@/utilities/queries"
import { buildBreadcrumbJsonLd, buildPersonJsonLd } from "@/utilities/structuredData"
import config from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React, { cache } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"

// Paginated with `?p=`, which only a request carries, so this is rendered per request. That's
// also why there's no generateStaticParams: a prerendered slug would never be served.
export const dynamic = "force-dynamic"

interface Args {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    p?: string
  }>
}

const ARTICLES_PER_PAGE = 5
const queryArticlesByAuthor = cache(async (userId: number, page: number = 1) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config })

  return payload.find({
    collection: "articles",
    draft,
    limit: ARTICLES_PER_PAGE,
    page,
    where: {
      authors: {
        equals: userId,
      },
    },
    depth: 2,
  })
})

export async function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  const { slug } = await params
  const { p } = await searchParams
  const user = await queryUserBySlug(slug)

  const name = user?.name || "Author"
  const title = `${name} — Pragmatic Papers`

  const affiliationPart = user?.affiliation ? `, ${user.affiliation}` : ""
  const description = `Articles and contributions by ${name}${affiliationPart}. Read their work on Pragmatic Papers.`

  const profileImage = user?.profileImage
  const ogImage =
    profileImage && typeof profileImage !== "number"
      ? getMediaUrl(profileImage.sizes?.og?.url || profileImage.url)
      : undefined

  const serverUrl = getServerSideURL()
  const canonicalUrl = `${serverUrl}${paginatedPath(`/authors/${slug}`, p)}`

  return {
    title,
    description,
    openGraph: mergeOpenGraph({
      title,
      description,
      url: canonicalUrl,
      type: "profile",
      images: ogImage ? [{ url: ogImage }] : undefined,
    }),
    twitter: {
      card: "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  }
}

export default async function AuthorPage({ params, searchParams }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug = "" } = await params
  const { p } = await searchParams
  let page = Number(p) || 1
  if (!Number.isInteger(page) || page < 1) page = 1

  const user = await queryUserBySlug(slug)
  const url = `/authors/${slug}`
  if (!user) return <PayloadRedirects url={url} />

  const {
    docs: articles,
    totalDocs,
    totalPages,
    page: currentPage,
  } = await queryArticlesByAuthor(user.id, page)
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

  const hasBiography = !!user.biography

  const profile = user.profileImage
  const profileImageUrl = isResolved(profile)
    ? (profile.sizes?.square?.url ?? undefined)
    : undefined
  const initials = getInitials(user.name || "Author")
  const trail = [
    { name: "Authors", path: "/authors" },
    { name: user.name || "Author", path: url },
  ]

  return (
    <>
      <Breadcrumbs items={trail} />
      <article className="mx-auto max-w-3xl space-y-6 px-4">
        <JsonLd data={[buildPersonJsonLd(user, url), buildBreadcrumbJsonLd(trail)]} />
        {/* Allows redirects for valid pages too */}
        <PayloadRedirects disableNotFound url={url} />

        {draft && <LivePreviewListener />}

        <header className="flex flex-col items-center space-y-3 text-center">
          {profile && (
            <Avatar size="2xl" className="aspect-square border">
              <AvatarImage
                src={profileImageUrl}
                render={<Media media={profile} variant="square" sizes="128px" priority />}
              />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          )}
          <h1>{user.name || "Author"}</h1>
          {user.affiliation && <p className="text-muted-foreground text-sm">{user.affiliation}</p>}
          <AuthorLinks socials={user.socials} />
        </header>

        {hasBiography && (
          <section className="mb-10" aria-label="Author biography">
            <h2 className="mb-3">Bio</h2>
            <RichText enableGutter={false} data={user.biography as ArticleType["content"]} />
          </section>
        )}

        <Separator className="my-16" />

        <section aria-label="Articles by this author">
          <div className="mb-4 flex items-center justify-between">
            <h2>Articles</h2>
            <PageRange
              collection="articles"
              currentPage={currentPage}
              limit={ARTICLES_PER_PAGE}
              totalDocs={totalDocs}
            />
          </div>
          {totalDocs === 0 ? (
            <p className="text-muted-foreground text-sm">{`Look out for this author's debut!`}</p>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-4">
                {articles.map((article) => {
                  const volume = volumeByArticleId.get(article.id)
                  return <AuthorArticleCard key={article.id} article={article} volume={volume} />
                })}
              </div>
              <Pagination page={currentPage} totalPages={totalPages} />
            </>
          )}
        </section>
      </article>
    </>
  )
}
