import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { formatHelpDocDate, helpDocs } from "@/docs"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { Metadata } from "next"
import Link from "next/link"
import React from "react"

const TITLE = "Help docs — Pragmatic Papers"
const DESCRIPTION = "What's new in the Pragmatic Papers admin, and how to use it."

export function generateMetadata(): Metadata {
  const canonicalUrl = `${getServerSideURL()}/docs`
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({ title: TITLE, description: DESCRIPTION, url: canonicalUrl }),
  }
}

export default function DocsIndexPage(): React.ReactNode {
  const trail: Crumb[] = [{ name: "Help docs", path: "/docs" }]

  return (
    <>
      <Breadcrumbs items={trail} />
      <article className="mx-auto max-w-3xl space-y-6 px-4">
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        <header className="space-y-3">
          <h1>Help docs</h1>
          <p className="text-muted-foreground text-sm">
            New features in the admin, and how to use them.
          </p>
        </header>
        <ul className="divide-y border-y">
          {helpDocs.map((doc) => (
            <li key={doc.slug} className="py-4">
              <Link href={`/docs/${doc.slug}`} className="group block space-y-1">
                <h2 className="text-xl group-hover:underline">{doc.title}</h2>
                <p className="text-muted-foreground text-sm">{doc.summary}</p>
                <p className="text-muted-foreground text-xs">
                  <time dateTime={doc.publishedAt}>{formatHelpDocDate(doc.publishedAt)}</time>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </>
  )
}
