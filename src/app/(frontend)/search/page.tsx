import { PageRange } from "@/components/PageRange"
import { Pagination } from "@/components/Pagination"
import configPromise from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import Link from "next/link"
import type { PaginatedDocs } from "payload"
import { getPayload } from "payload"
import React, { cache } from "react"

interface SearchResult {
  id: number
  title?: string | null
  excerpt?: string | null
  slug?: string | null
  doc?: { relationTo: string; value: unknown } | null
}

const RESULTS_PER_PAGE = 10

function collectionHref(relationTo: string, slug: string): string {
  if (relationTo === "articles") return `/articles/${slug}`
  if (relationTo === "volumes") return `/volumes/${slug}`
  if (relationTo === "topics") return `/topics/${slug}`
  return `/${slug}`
}

const querySearch = cache(async (query: string, page: number) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })
  const result: PaginatedDocs<SearchResult> = await payload.find({
    collection: "search",
    draft,
    limit: RESULTS_PER_PAGE,
    page,
    overrideAccess: draft,
    where: query ? { title: { like: query } } : undefined,
  })
  return result
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
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
            {docs.map((result) => {
              const relationTo = result.doc?.relationTo ?? ""
              const href = collectionHref(relationTo, result.slug ?? "")

              return (
                <li key={result.id} className="border-b pb-4 last:border-0">
                  <Link href={href} className="hover:underline">
                    <h2 className="text-lg font-semibold">{result.title}</h2>
                  </Link>
                  {result.excerpt && (
                    <p className="text-muted-foreground mt-1 text-sm">{result.excerpt}</p>
                  )}
                  <span className="text-muted-foreground mt-1 block text-xs capitalize">
                    {relationTo}
                  </span>
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
