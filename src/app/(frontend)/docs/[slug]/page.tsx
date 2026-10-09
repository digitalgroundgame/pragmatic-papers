import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import RichText from "@/components/RichText"
import { Separator } from "@/components/ui/separator"
import { queryDocBySlug, queryPublishedDocs } from "@/plugins/docs/queries"
import { formatNotificationDate } from "@/plugins/notifications/unread"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import React from "react"

interface Args {
  params: Promise<{ slug: string }>
}

// Prerendered from generateStaticParams; a doc published since the build is rendered on its
// first request and cached the same way. Saving a doc revalidates it.
export const revalidate = 3600

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const docs = await queryPublishedDocs()
  return docs.flatMap(({ slug }) => (slug ? [{ slug }] : []))
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const doc = await queryDocBySlug(slug)
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
  const { isEnabled: draft } = await draftMode()
  const { slug } = await params
  const url = `/docs/${slug}`
  const doc = await queryDocBySlug(slug)
  if (!doc) return <PayloadRedirects url={url} />

  const trail: Crumb[] = [
    { name: "Help docs", path: "/docs" },
    { name: doc.title, path: url },
  ]

  // The article page's layout and type, so a doc reads like one.
  return (
    <>
      <Breadcrumbs items={trail} />
      <article className="mx-auto max-w-5xl min-w-0 space-y-6 px-4 pb-16">
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        {draft && <LivePreviewListener />}
        <header className="flex flex-col gap-2">
          <h1 className="mt-3">{doc.title}</h1>
          <time className="text-foreground font-serif" dateTime={doc.publishedAt.slice(0, 10)}>
            {formatNotificationDate(doc.publishedAt)}
          </time>
          <Separator />
        </header>
        <div className="mx-auto max-w-2xl">
          <RichText data={doc.content} enableGutter={false} className="drop-cap" />
        </div>
      </article>
    </>
  )
}
