import type { Metadata } from "next"
import React from "react"

import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"

import { SITEMAPS } from "../(sitemaps)/sitemaps"
import { FEEDS } from "./feeds"

const TITLE = "Feeds and sitemaps — Pragmatic Papers"
const DESCRIPTION = "Follow Pragmatic Papers in a feed reader, or find every page we publish."

// Built from the lists in code, so a new feed or sitemap shows up here without anyone editing
// the CMS. A build prerenders it with the build's SERVER_URL; /next/revalidate-all re-renders it
// with the runtime one, like the sitemap index.
export const dynamic = "force-static"

export function generateMetadata(): Metadata {
  const canonicalUrl = `${getServerSideURL()}/feeds`
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({ title: TITLE, description: DESCRIPTION, url: canonicalUrl }),
  }
}

const LinkList: React.FC<{
  links: readonly { path: string; title: string; description?: string }[]
}> = ({ links }) => {
  const siteUrl = getServerSideURL().replace(/\/$/, "")
  return (
    <ul className="divide-y border-y">
      {links.map((link) => (
        <li key={link.path} className="space-y-1 py-3">
          {/* Plain links: these are XML files, not pages to prefetch. */}
          <a href={link.path} className="font-medium hover:underline">
            {link.title}
          </a>
          {link.description && <p className="text-muted-foreground text-sm">{link.description}</p>}
          <p className="text-muted-foreground font-mono text-xs break-all">
            {siteUrl}
            {link.path}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default function FeedsPage(): React.ReactNode {
  const trail: Crumb[] = [{ name: "Feeds and sitemaps", path: "/feeds" }]

  return (
    <>
      <Breadcrumbs items={trail} />
      <article className="mx-auto max-w-3xl space-y-8 px-4">
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        <header className="space-y-3">
          <h1>Feeds and sitemaps</h1>
          <p className="text-muted-foreground text-sm">{DESCRIPTION}</p>
        </header>
        <section className="space-y-3">
          <h2>RSS feeds</h2>
          <p className="text-muted-foreground text-sm">
            Paste a feed&apos;s address into your feed reader to get new pieces as they&apos;re
            published.
          </p>
          <LinkList links={FEEDS} />
        </section>
        <section className="space-y-3">
          <h2>Sitemaps</h2>
          <p className="text-muted-foreground text-sm">
            For search engines: the sitemap index lists all the others.
          </p>
          <LinkList links={[{ path: "/sitemap.xml", title: "Sitemap index" }, ...SITEMAPS]} />
        </section>
      </article>
    </>
  )
}
