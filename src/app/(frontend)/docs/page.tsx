import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { isStaffReader, queryPublishedDocs } from "@/plugins/docs/queries"
import { formatNotificationDate } from "@/plugins/notifications/unread"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { Metadata } from "next"
import Link from "next/link"
import React from "react"

const TITLE = "Docs — Pragmatic Papers"
const DESCRIPTION = "What's new in the Pragmatic Papers admin, and how to use it."

// Rendered per request, because staff also see the docs written for some roles. The docs come
// from the data cache, which saving a doc or the start-up sync refreshes.
export const dynamic = "force-dynamic"

export function generateMetadata(): Metadata {
  const canonicalUrl = `${getServerSideURL()}/docs`
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({ title: TITLE, description: DESCRIPTION, url: canonicalUrl }),
  }
}

export default async function DocsIndexPage(): Promise<React.ReactNode> {
  const docs = await queryPublishedDocs({ staff: await isStaffReader() })
  const trail: Crumb[] = [{ name: "Docs", path: "/docs" }]

  return (
    <>
      <Breadcrumbs items={trail} />
      <article className="mx-auto max-w-3xl space-y-6 px-4">
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        <header className="space-y-3">
          <h1>Docs</h1>
          <p className="text-muted-foreground text-sm">
            New features in the admin, and how to use them.
          </p>
        </header>
        {docs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No docs yet.</p>
        ) : (
          <ul className="divide-y border-y">
            {docs.map((doc) => (
              <li key={doc.id} className="py-4">
                <Link href={`/docs/${doc.slug}`} className="group block space-y-1">
                  <h2 className="text-xl group-hover:underline">{doc.title}</h2>
                  <p className="text-muted-foreground text-sm">{doc.summary}</p>
                  <p className="text-muted-foreground text-xs">
                    <time dateTime={doc.publishedAt.slice(0, 10)}>
                      {formatNotificationDate(doc.publishedAt)}
                    </time>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </>
  )
}
