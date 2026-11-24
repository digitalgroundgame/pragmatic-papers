import { MediaRow, MediaRowList } from "@/components/MediaRow"
import { PageRange } from "@/components/PageRange"
import { Pagination } from "@/components/Pagination"
import type { Media as MediaType } from "@/payload-types"
import { formatList } from "@/utilities/formatList"
import { sql } from "@payloadcms/db-postgres"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import type { PaginatedDocs } from "payload"
import React, { cache } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { PageHeader, PageShell } from "@/components/PageShell"
import { MostReadPanel, SearchTipsPanel, TopicsPanel, WithAside } from "@/components/Aside"
import { docPath } from "@/utilities/routes"
import { getPayloadClient } from "@/data/payload"
import { firstParam } from "./firstParam"

interface SearchResult {
  id: number
  title?: string | null
  excerpt?: string | null
  slug?: string | null
  authors?: string | null
  topics?: string | null
  image?: MediaType | number | null
  doc?: { relationTo: string; value: unknown } | null
}

const RESULTS_PER_PAGE = 10
const MAX_QUERY_LENGTH = 200

const querySearch = cache(async (rawQuery: string, page: number) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadClient()
  const query = rawQuery.slice(0, MAX_QUERY_LENGTH).trim()

  if (!query) {
    return payload.find({
      collection: "search",
      draft,
      depth: 1,
      limit: RESULTS_PER_PAGE,
      page,
      overrideAccess: draft,
      sort: "-priority",
    })
  }

  const offset = (page - 1) * RESULTS_PER_PAGE

  // Using offset means we have to query the total result count separately.
  // You could try to use a window func to avoid making two queries but in some cases
  // this ends up making query performance worse.
  const [ranked, countResult] = await Promise.all([
    payload.db.drizzle.execute<{ id: number; rank: number }>(sql`
      SELECT id,
             ts_rank_cd(search_vector, websearch_to_tsquery('english', ${query})) AS rank
        FROM search
       WHERE search_vector @@ websearch_to_tsquery('english', ${query})
       ORDER BY rank DESC, priority DESC NULLS LAST
       LIMIT ${RESULTS_PER_PAGE} OFFSET ${offset}
    `),
    payload.db.drizzle.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count
        FROM search
       WHERE search_vector @@ websearch_to_tsquery('english', ${query})
    `),
  ])

  const ids = ranked.rows.map((r) => r.id)
  const totalDocs = countResult.rows[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalDocs / RESULTS_PER_PAGE))

  const emptyPage: PaginatedDocs<SearchResult> = {
    docs: [],
    totalDocs,
    totalPages,
    page,
    limit: RESULTS_PER_PAGE,
    pagingCounter: offset + 1,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  }

  if (ids.length === 0) return emptyPage

  const { docs } = await payload.find({
    collection: "search",
    draft,
    depth: 1,
    limit: RESULTS_PER_PAGE,
    where: { id: { in: ids } },
    overrideAccess: draft,
    pagination: false,
  })

  // Preserve ts_rank ordering — payload.find won't honor it.
  const byId = new Map(docs.map((d) => [d.id, d as unknown as SearchResult]))
  const sorted = ids.map((id) => byId.get(id)).filter((d): d is SearchResult => Boolean(d))

  return { ...emptyPage, docs: sorted }
})

const KIND_LABELS: Record<string, string> = { volumes: "Volume", topics: "Topic", pages: "Page" }

/** Topic slugs by name: a search row stores its topics' names only. */
const queryTopicSlugs = cache(async (): Promise<Map<string, string>> => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "topics",
    pagination: false,
    depth: 0,
    select: { name: true, slug: true },
  })
  return new Map(docs.flatMap((t) => (t.slug ? [[t.name, t.slug] as const] : [])))
})

// Results pages are endless variations of pages that are already indexed, and Google asks sites
// not to let them into its index. Links on them are still followed.
export const metadata: Metadata = {
  title: "Search | The Pragmatic Papers",
  robots: { index: false, follow: true },
}

interface Args {
  searchParams: Promise<{ q?: string | string[]; p?: string | string[] }>
}

export default async function SearchPage({ searchParams }: Args): Promise<React.ReactNode> {
  const params = await searchParams
  const q = firstParam(params.q) ?? ""
  const p = firstParam(params.p)
  let page = Number(p) || 1
  if (!Number.isInteger(page) || page < 1) page = 1

  const [{ docs, totalDocs, totalPages, page: currentPage }, topicSlugs] = await Promise.all([
    querySearch(q, page),
    queryTopicSlugs(),
  ])

  return (
    <>
      <Breadcrumbs shell items={[{ name: "Search", path: "/search" }]} />
      <PageShell as="div">
        <PageHeader title="Search" />
        <WithAside
          aside={
            <>
              <SearchTipsPanel />
              <TopicsPanel />
              <MostReadPanel />
            </>
          }
        >
          <form action="/search" method="get" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search…"
              className="border-input bg-background placeholder:text-muted-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
            >
              Search
            </button>
          </form>

          {q && (
            <div className="flex items-center justify-between">
              <PageRange
                collectionLabels={{ plural: "Results", singular: "Result" }}
                currentPage={currentPage}
                limit={RESULTS_PER_PAGE}
                totalDocs={totalDocs}
              />
            </div>
          )}

          {docs.length > 0 ? (
            <>
              <MediaRowList>
                {docs.map((result: SearchResult) => {
                  const relationTo = result.doc?.relationTo ?? ""
                  const topicNames = result.topics ? result.topics.split(", ") : []
                  return (
                    <MediaRow
                      key={result.id}
                      href={docPath(relationTo, result.slug ?? "")}
                      title={result.title}
                      summary={result.excerpt}
                      image={result.image}
                      byline={
                        result.authors &&
                        `By ${formatList(result.authors.split(", "), { conjunction: "&" })}`
                      }
                      // Articles are most results; only say what kind the others are.
                      meta={relationTo === "articles" ? null : KIND_LABELS[relationTo]}
                      badges={topicNames.flatMap((name) => {
                        const slug = topicSlugs.get(name)
                        return slug ? [{ label: name, href: `/topics/${slug}` }] : []
                      })}
                    />
                  )
                })}
              </MediaRowList>

              <Pagination
                page={currentPage}
                totalPages={totalPages}
                buildHref={(pageNum) => `/search?q=${encodeURIComponent(q)}&p=${pageNum}`}
              />
            </>
          ) : q ? (
            <PageRange
              collectionLabels={{ plural: "Results", singular: "Result" }}
              currentPage={currentPage}
              limit={RESULTS_PER_PAGE}
              totalDocs={0}
            />
          ) : null}
        </WithAside>
      </PageShell>
    </>
  )
}
