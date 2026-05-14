import { Media, isMedia } from "@/components/Media"
import { PageRange } from "@/components/PageRange"
import { Pagination } from "@/components/Pagination"
import type { Media as MediaType } from "@/payload-types"
import configPromise from "@payload-config"
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
  image?: MediaType | number | null
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
    depth: 1,
    limit: RESULTS_PER_PAGE,
    page,
    overrideAccess: draft,
    sort: "-priority",
    where: query ? { or: [{ title: { like: query } }, { authors: { like: query } }] } : undefined,
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
                        <span className="capitalize">{`in ${relationTo}`}</span>
                        {result.authors && (
                          <>
                            <span>{"•"}</span>
                            <span>{`by ${result.authors}`}</span>
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
