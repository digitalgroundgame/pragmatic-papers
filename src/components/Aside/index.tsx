import { sql } from "@payloadcms/db-postgres"
import React, { cache } from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { NewsletterSignupForm } from "@/blocks/NewsletterSignup/Component.client"
import { getPayloadClient } from "@/data/payload"
import { cn } from "@/utilities/utils"

/**
 * PROTOTYPE: the aside panels for listing pages, for screenshots. Each panel is meant to
 * become a block editors pick and order in an "Asides" global.
 */

/** Main column plus a sticky aside, side by side from lg up; the aside drops below on mobile. */
export function WithAside({
  aside,
  children,
}: {
  aside: React.ReactNode
  children: React.ReactNode
}): React.ReactNode {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">{children}</div>
      <aside aria-label="More to read" className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        {aside}
      </aside>
    </div>
  )
}

export function AsidePanel({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}): React.ReactNode {
  return (
    <section className={cn("space-y-3 rounded-sm border p-4", className)}>
      <h2 className="text-brand-text font-serif text-xs font-semibold tracking-widest uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

const rows = async <T extends Record<string, unknown>>(
  query: ReturnType<typeof sql>,
): Promise<T[]> => {
  const payload = await getPayloadClient()
  const result = await payload.db.drizzle.execute<T>(query)
  return result.rows as T[]
}

const mostRead = cache((topicId?: number) =>
  rows<{ slug: string; title: string; views: number }>(sql`
    SELECT a.slug, a.title, SUM(v.views)::int AS views
      FROM article_views v JOIN articles a ON a.id = v.article_id
     WHERE v.day > (now() at time zone 'utc')::date - 7 AND a._status = 'published'
       ${topicId ? sql`AND EXISTS (SELECT 1 FROM articles_rels r WHERE r.parent_id = a.id AND r.path = 'topics' AND r.topics_id = ${topicId})` : sql``}
     GROUP BY a.id ORDER BY views DESC LIMIT 5
  `),
)

export async function MostReadPanel({ topicId }: { topicId?: number }): Promise<React.ReactNode> {
  const articles = await mostRead(topicId)
  if (!articles.length) return null
  return (
    <AsidePanel title={topicId ? "Most read in this topic" : "Most read this week"}>
      <ol className="space-y-3">
        {articles.map((a, i) => (
          <li key={a.slug} className="flex gap-3">
            <span className="text-muted-foreground font-serif text-2xl leading-none tabular-nums">
              {i + 1}
            </span>
            <HoverPrefetchLink
              href={`/articles/${a.slug}`}
              className="text-sm leading-snug font-medium hover:underline"
            >
              {a.title}
            </HoverPrefetchLink>
          </li>
        ))}
      </ol>
    </AsidePanel>
  )
}

const latestVolume = cache(() =>
  rows<{ slug: string; title: string; volume_number: number; articles: number }>(sql`
    SELECT v.slug, v.title, v.volume_number::int AS volume_number,
           (SELECT COUNT(*)::int FROM volumes_rels r WHERE r.parent_id = v.id AND r.path = 'articles') AS articles
      FROM volumes v WHERE v._status = 'published'
     ORDER BY v.published_at DESC NULLS LAST LIMIT 1
  `),
)

export async function LatestVolumePanel(): Promise<React.ReactNode> {
  const [volume] = await latestVolume()
  if (!volume) return null
  return (
    <AsidePanel title="Latest volume">
      <HoverPrefetchLink href={`/volumes/${volume.slug}`} className="group block space-y-1">
        <p className="text-muted-foreground text-xs">Volume {volume.volume_number}</p>
        <p className="font-serif text-lg leading-snug font-semibold group-hover:underline">
          {volume.title}
        </p>
        <p className="text-muted-foreground text-xs">
          {volume.articles} {volume.articles === 1 ? "article" : "articles"}
        </p>
      </HoverPrefetchLink>
    </AsidePanel>
  )
}

const topicCounts = cache(() =>
  rows<{ slug: string; name: string; count: number }>(sql`
    SELECT t.slug, t.name, COUNT(a.id)::int AS count
      FROM topics t
      JOIN articles_rels r ON r.topics_id = t.id AND r.path = 'topics'
      JOIN articles a ON a.id = r.parent_id AND a._status = 'published'
     GROUP BY t.id ORDER BY count DESC, t.name LIMIT 8
  `),
)

function TopicCountList({
  topics,
}: {
  topics: { slug: string; name: string; count: number }[]
}): React.ReactNode {
  return (
    <ul className="space-y-1.5 text-sm">
      {topics.map((t) => (
        <li key={t.slug} className="flex justify-between gap-3">
          <HoverPrefetchLink href={`/topics/${t.slug}`} className="hover:underline">
            {t.name}
          </HoverPrefetchLink>
          <span className="text-muted-foreground tabular-nums">{t.count}</span>
        </li>
      ))}
    </ul>
  )
}

export async function TopicsPanel(): Promise<React.ReactNode> {
  const topics = await topicCounts()
  if (!topics.length) return null
  return (
    <AsidePanel title="Browse topics">
      <TopicCountList topics={topics} />
      <HoverPrefetchLink href="/topics" className="text-sm underline underline-offset-4">
        All topics
      </HoverPrefetchLink>
    </AsidePanel>
  )
}

const relatedTopics = cache((topicId: number) =>
  rows<{ slug: string; name: string; count: number }>(sql`
    SELECT t.slug, t.name, COUNT(*)::int AS count
      FROM articles_rels mine
      JOIN articles a ON a.id = mine.parent_id AND a._status = 'published'
      JOIN articles_rels other ON other.parent_id = mine.parent_id AND other.path = 'topics'
                              AND other.topics_id <> ${topicId}
      JOIN topics t ON t.id = other.topics_id
     WHERE mine.path = 'topics' AND mine.topics_id = ${topicId}
     GROUP BY t.id ORDER BY count DESC, t.name LIMIT 6
  `),
)

export async function RelatedTopicsPanel({
  topicId,
}: {
  topicId: number
}): Promise<React.ReactNode> {
  const topics = await relatedTopics(topicId)
  if (!topics.length) return null
  return (
    <AsidePanel title="Often paired with">
      <TopicCountList topics={topics} />
    </AsidePanel>
  )
}

const topicContributors = cache((topicId: number) =>
  rows<{ slug: string; name: string; count: number }>(sql`
    SELECT u.slug, u.name, COUNT(DISTINCT a.id)::int AS count
      FROM articles_rels t
      JOIN articles a ON a.id = t.parent_id AND a._status = 'published'
      JOIN articles_rels au ON au.parent_id = a.id AND au.path = 'authors'
      JOIN users u ON u.id = au.users_id
     WHERE t.path = 'topics' AND t.topics_id = ${topicId}
     GROUP BY u.id ORDER BY count DESC, u.name LIMIT 6
  `),
)

export async function ContributorsPanel({
  topicId,
}: {
  topicId: number
}): Promise<React.ReactNode> {
  const people = await topicContributors(topicId)
  if (!people.length) return null
  return (
    <AsidePanel title="Who writes on this">
      <ul className="space-y-1.5 text-sm">
        {people.map((p) => (
          <li key={p.slug} className="flex justify-between gap-3">
            <HoverPrefetchLink href={`/contributors/${p.slug}`} className="hover:underline">
              {p.name}
            </HoverPrefetchLink>
            <span className="text-muted-foreground tabular-nums">
              {p.count} {p.count === 1 ? "article" : "articles"}
            </span>
          </li>
        ))}
      </ul>
    </AsidePanel>
  )
}

export function SearchTipsPanel(): React.ReactNode {
  return (
    <AsidePanel title="Search tips">
      <ul className="text-muted-foreground space-y-2 text-sm">
        <li>
          <code className="text-foreground">&quot;exact phrase&quot;</code> matches words in order
        </li>
        <li>
          <code className="text-foreground">senate -house</code> leaves out a word
        </li>
        <li>
          <code className="text-foreground">courts or judges</code> matches either
        </li>
      </ul>
    </AsidePanel>
  )
}

export function NewsletterPanel(): React.ReactNode {
  return (
    <AsidePanel title="Newsletter">
      <NewsletterSignupForm
        id="aside-newsletter"
        blockType="newsletterSignup"
        heading="Get Daily Pragmatic Papers"
        description="One email a day with the newest articles."
        buttonLabel="Sign up"
      />
    </AsidePanel>
  )
}
