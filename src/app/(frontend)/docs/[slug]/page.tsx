import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { findHelpDoc, formatHelpDocDate, helpDocs } from "@/docs"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { MDXContent } from "mdx/types"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"

interface Args {
  params: Promise<{ slug: string }>
}

// Every article is in the repo, so every page is built ahead and any other slug is a 404.
export const dynamicParams = false

export function generateStaticParams(): { slug: string }[] {
  return helpDocs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const doc = findHelpDoc(slug)
  if (!doc) return {}

  const title = `${doc.title} — Pragmatic Papers`
  const canonicalUrl = `${getServerSideURL()}/docs/${slug}`
  return {
    title,
    description: doc.summary,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({ title, description: doc.summary, url: canonicalUrl }),
  }
}

export default async function DocPage({ params }: Args): Promise<React.ReactNode> {
  const { slug } = await params
  const doc = findHelpDoc(slug)
  if (!doc) notFound()

  const { default: Body } = (await import(`@/docs/${slug}.md`)) as { default: MDXContent }
  const trail: Crumb[] = [
    { name: "Help docs", path: "/docs" },
    { name: doc.title, path: `/docs/${slug}` },
  ]

  return (
    <>
      <Breadcrumbs items={trail} />
      <article className="container max-w-3xl space-y-6">
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        <header className="space-y-3">
          <h1>{doc.title}</h1>
          <p className="text-muted-foreground text-sm">
            <time dateTime={doc.publishedAt}>{formatHelpDocDate(doc.publishedAt)}</time>
          </p>
        </header>
        <div className="prose prose-lg prose-brand prose-p:leading-relaxed max-w-none font-serif">
          <Body />
        </div>
      </article>
    </>
  )
}
