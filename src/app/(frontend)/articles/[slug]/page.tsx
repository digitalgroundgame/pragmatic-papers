import { AuthorList } from "@/components/Authors/AuthorList"
import { FootnoteList } from "@/components/FootnoteList"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import RichText from "@/components/RichText"
import { TopicsList } from "@/components/Topics/TopicsList"
import { Separator } from "@/components/ui/separator"
import { ArticleHero } from "@/heros/ArticleHero"
import { MathJaxProvider } from "@/providers/MathJaxProvider"
import { generateMeta } from "@/utilities/generateMeta"
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import configPromise from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React, { cache } from "react"

export async function generateStaticParams(): Promise<{ slug: string | null | undefined }[]> {
  const payload = await getPayload({ config: configPromise })
  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
    context: {
      skipAfterRead: true,
    },
  })

  const params = articles.docs.map(({ slug }) => {
    return { slug }
  })

  return params
}

interface Args {
  params: Promise<{
    slug?: string
  }>
}

const queryArticleBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: "articles",
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = "" } = await paramsPromise
  const article = await queryArticleBySlug(slug)

  return generateMeta({ doc: article, canonicalPath: `/articles/${slug}` })
}

export default async function Article({ params: paramsPromise }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug = "" } = await paramsPromise
  const url = "/articles/" + slug
  const article = await queryArticleBySlug(slug)

  if (!article) return <PayloadRedirects url={url} />

  const { footnotes, content, populatedAuthors, enableMathRendering, topics } = article

  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 md:px-1">
      <JsonLd
        data={[
          buildArticleJsonLd(article, url),
          buildBreadcrumbJsonLd([{ name: article.meta?.title || article.title, path: url }]),
        ]}
      />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <ArticleHero article={article} />
      <MathJaxProvider enableMathRendering={enableMathRendering}>
        <RichText
          data={content}
          enableGutter={false}
          className="drop-cap"
          parentDoc={{ collection: "articles", id: article.id }}
        />
      </MathJaxProvider>
      <FootnoteList footnotes={footnotes} />
      <Separator />
      <TopicsList topics={topics} />
      <AuthorList aria-label="Article Authors" authors={populatedAuthors} />
    </article>
  )
}
