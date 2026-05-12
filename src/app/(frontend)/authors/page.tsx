import { AuthorList } from "@/components/Authors/AuthorList"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PageRange } from "@/components/PageRange"
import { Pagination } from "@/components/Pagination"
import type { PopulatedAuthorsSelect } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import config from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React, { cache } from "react"

export const metadata: Metadata = {
  title: "Authors — Pragmatic Papers",
  description: "Discover all Pragmatic Papers authors and explore their published work.",
  openGraph: mergeOpenGraph({
    title: "Authors — Pragmatic Papers",
    description: "Discover all Pragmatic Papers authors and explore their published work.",
    url: `${getServerSideURL()}/authors`,
  }),
}

const AUTHORS_PER_PAGE = 6

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

  const { docs: authors, totalDocs, totalPages, page: currentPage } = await queryAuthors(page)

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4">
      {draft && <LivePreviewListener />}

      <header className="space-y-3">
        <h1>Authors</h1>
        <p className="text-muted-foreground text-sm">
          Learn more about The Pragmatic Papers contributors and explore their work.
        </p>
      </header>

      <section aria-label="All authors" className="mt-6">
        {authors.length === 0 ? (
          <p className="text-muted-foreground text-sm">No authors available yet.</p>
        ) : (
          <>
            <div className="flex justify-center">
              <PageRange
                collectionLabels={{ plural: "Authors", singular: "Author" }}
                currentPage={currentPage}
                limit={AUTHORS_PER_PAGE}
                totalDocs={totalDocs}
              />
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <AuthorList authors={authors} />
            </div>
            {totalPages > 1 && currentPage && (
              <div className="mt-6 flex justify-center">
                <Pagination page={currentPage} totalPages={totalPages} />
              </div>
            )}
          </>
        )}
      </section>
    </article>
  )
}
