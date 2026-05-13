import { AuthorCard } from "@/components/Authors/AuthorCard"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PageRange } from "@/components/PageRange"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import type { PopulatedAuthorsSelect } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import config from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React, { cache, Suspense } from "react"

export const metadata: Metadata = {
  title: "Authors — Pragmatic Papers",
  description: "Discover all Pragmatic Papers authors and explore their published work.",
  openGraph: mergeOpenGraph({
    title: "Authors — Pragmatic Papers",
    description: "Discover all Pragmatic Papers authors and explore their published work.",
    url: `${getServerSideURL()}/authors`,
  }),
}

const AUTHORS_PER_PAGE = 5

const queryAuthors = cache(async (page: number = 1) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config })

  const select: PopulatedAuthorsSelect<true> = {
    id: true,
    name: true,
    slug: true,
    affiliation: true,
    biography: true,
    profileImage: true,
    socials: true,
  }

  return await payload.find({
    collection: "users",
    draft,
    limit: AUTHORS_PER_PAGE,
    page,
    pagination: true,
    sort: "name",
    depth: 1,
    where: {
      role: {
        in: ["writer", "editor", "chief-editor"],
      },
    },
    select,
  })
})

async function AuthorContent({ page }: { page: number }) {
  const { docs: authors, totalDocs, totalPages, page: currentPage } = await queryAuthors(page)

  if (authors.length === 0) {
    return <p className="text-muted-foreground text-center text-sm">No authors found.</p>
  }

  return (
    <>
      <section aria-label="All authors">
        <div className="mb-4 flex items-center justify-between">
          <h2>Meet the Author{authors.length > 1 ? "s" : ""}</h2>
          <PageRange
            collectionLabels={{ plural: "Authors", singular: "Author" }}
            currentPage={currentPage}
            limit={AUTHORS_PER_PAGE}
            totalDocs={totalDocs}
          />
        </div>
        <div className="flex flex-col gap-4">
          {authors.map((author) => (
            <AuthorCard key={author.id} author={author} />
          ))}
        </div>
      </section>
      {totalPages > 1 && currentPage && (
        <Pagination
          className="mt-6 flex justify-center"
          page={currentPage}
          totalPages={totalPages}
        />
      )}
    </>
  )
}

function AuthorContentSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2>Meet the Authors</h2>
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: AUTHORS_PER_PAGE }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-sm border p-4">
            <Skeleton className="size-24 shrink-0 rounded-sm" />
            <div className="flex flex-1 flex-col justify-between gap-3 space-y-2">
              <div className="space-y-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="size-4 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Args {
  searchParams: Promise<{
    p?: string
  }>
}

export default async function AuthorsIndexPage({ searchParams }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { p } = await searchParams
  let page = Number(p) || 1
  if (!Number.isInteger(page) || page < 1) page = 1

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4">
      {draft && <LivePreviewListener />}

      <header className="space-y-3">
        <h1>Authors</h1>
        <p className="text-muted-foreground text-sm">
          Learn more about The Pragmatic Papers contributors and explore their work.
        </p>
      </header>

      <Suspense fallback={<AuthorContentSkeleton />}>
        <AuthorContent page={page} />
      </Suspense>
    </article>
  )
}
