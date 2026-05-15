import { Media, isMedia } from "@/components/Media"
import { PageRange } from "@/components/PageRange"
import { Pagination } from "@/components/Pagination"
import type { Media as MediaType } from "@/payload-types"
import { arrayStringToPlainText } from "@/utilities/formatAuthors"
import configPromise from "@payload-config"
import { sql } from "@payloadcms/db-postgres"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import type { PaginatedDocs } from "payload"
import { getPayload } from "payload"
import React, { cache } from "react"

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

function collectionHref(relationTo: string, slug: string): string {
  if (relationTo === "articles") return `/articles/${slug}`
  if (relationTo === "volumes") return `/volumes/${slug}`
  if (relationTo === "topics") return `/topics/${slug}`
  return `/${slug}`
}

const querySearch = cache(async (rawQuery: string, page: number) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })
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

export const metadata: Metadata = { title: "Search | The Pragmatic Papers" }

interface Args {
  searchParams: Promise<{ q?: string; p?: string }>
}

export default async function SearchPage({ searchParams }: Args): Promise<React.ReactNode> {
  const { q = "", p } = await searchParams
  let page = Number(p) || 1
  if (!Number.isInteger(page) || page < 1) page = 1

  const { docs, totalDocs, totalPages, page: currentPage } = await querySearch(q, page)

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4">
      <h1>Search</h1>

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
          <ul className="space-y-4">
            {docs.map((result: SearchResult) => {
              const relationTo = result.doc?.relationTo ?? ""
              const href = collectionHref(relationTo, result.slug ?? "")

              const image = isMedia(result.image) ? result.image : null
              return (
                <li key={result.id} className="border-b pb-4 last:border-0">
                  <div className="flex gap-4">
                    {image && (
                      <div className="bg-muted shrink-0 overflow-hidden rounded-sm border md:h-20 md:w-28">
                        <a href={href} tabIndex={-1} aria-hidden>
                          <Media
                            media={image}
                            variant="thumbnail"
                            sizes="112px"
                            className="aspect-3/2 h-full w-full object-cover"
                          />
                        </a>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <a href={href} className="hover:underline">
                        <h2 className="text-lg font-semibold">{result.title}</h2>
                      </a>
                      {result.excerpt && (
                        <p className="text-muted-foreground line-clamp-2 text-sm">
                          {result.excerpt}
                        </p>
                      )}
                      <div className="text-muted-foreground mt-auto flex items-center gap-2 text-xs">
                        <span className="capitalize">{relationTo}</span>
                        {result.topics && (
                          <>
                            <span>{"•"}</span>
                            <span>{`${arrayStringToPlainText(result.topics, ", ", "&")}`}</span>
                          </>
                        )}
                        {result.authors && (
                          <>
                            <span>{"•"}</span>
                            <span>{`by ${arrayStringToPlainText(result.authors, ", ", "&")}`}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {totalPages > 1 && currentPage && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              buildHref={(pageNum) => `/search?q=${encodeURIComponent(q)}&p=${pageNum}`}
            />
          )}
        </>
      ) : q ? (
        <PageRange
          collectionLabels={{ plural: "Results", singular: "Result" }}
          currentPage={currentPage}
          limit={RESULTS_PER_PAGE}
          totalDocs={0}
        />
      ) : null}
    </main>
  )
}
