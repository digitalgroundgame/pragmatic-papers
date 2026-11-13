import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import React, { cache } from "react"

import { whipCountPath } from "@/collections/WhipCounts/tag"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Separator } from "@/components/ui/separator"
import { getPayloadClient } from "@/data/payload"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { parseWhipCount } from "@/interactives/whip-count/model"
import { WhipCount } from "@/interactives/whip-count/WhipCount"
import type { WhipCount as WhipCountDoc } from "@/payload-types"
import { generateMeta } from "@/utilities/generateMeta"

// Rendered per request: the page reads draftMode(), and the count changes whenever an editor
// pastes a new one. The edge still caches it for anonymous readers, and saving purges it.
export const dynamic = "force-dynamic"

interface Args {
  params: Promise<{ slug?: string }>
}

/**
 * The whip count at a slug, or null. Whip counts are part of the `interactives` experiment
 * (Settings), so with it off in this environment there is none at any slug.
 */
const queryWhipCountBySlug = cache(async (slug: string): Promise<WhipCountDoc | null> => {
  if (!(await isExperimentEnabled("interactives"))) return null
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "whip-counts",
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: { slug: { equals: slug } },
    depth: 0,
  })
  return docs[0] ?? null
})

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = "" } = await paramsPromise
  const doc = await queryWhipCountBySlug(slug)
  return generateMeta({
    doc: doc ? { meta: { title: doc.title, description: doc.intro } } : null,
    canonicalPath: whipCountPath(slug),
  })
}

/**
 * A whip count's page: the editor's title and standfirst, then the count from the document's
 * pasted JSON, which the reader can redraft in their browser.
 */
export default async function WhipCountPage({
  params: paramsPromise,
}: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug = "" } = await paramsPromise
  const doc = await queryWhipCountBySlug(slug)
  if (!doc) notFound()

  const url = whipCountPath(slug)
  // Saving validates the data, so this only fails for a draft autosaved mid-edit.
  const parsed = parseWhipCount(doc.data)

  return (
    <>
      <Breadcrumbs
        fullWidth
        items={[
          { name: "Interactives", path: "/interactives" },
          { name: doc.title, path: url },
        ]}
      />
      <div className="container pt-8 pb-16">
        {draft && <LivePreviewListener />}

        <header className="max-w-3xl">
          <p className="text-brand-text font-serif text-xs font-semibold tracking-widest uppercase">
            Interactive
          </p>
          <h1 className="mt-2">{doc.title}</h1>
          {doc.intro && <p className="mt-4 text-lg">{doc.intro}</p>}
        </header>

        <Separator className="my-6" />

        {parsed.success ? (
          <WhipCount data={parsed.value} storageKey={slug} />
        ) : (
          <p
            data-whip-count-empty=""
            className="border-border text-muted-foreground my-8 rounded-lg border border-dashed p-8 text-center text-sm"
          >
            {draft
              ? `This count's data can't be read: ${parsed.error}`
              : "This count has no data yet."}
          </p>
        )}

        {doc.methodology && (
          <section className="text-muted-foreground mt-10 max-w-3xl text-sm">
            <h2 className="text-foreground text-base font-semibold">How this is counted</h2>
            <p className="mt-2 whitespace-pre-line">{doc.methodology}</p>
          </section>
        )}
      </div>
    </>
  )
}
