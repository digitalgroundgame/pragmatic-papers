import configPromise from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React from "react"

import "@/blocks/InteractiveMap/styles.css"

import { DrilldownMap } from "@/blocks/InteractiveMap/drilldown/DrilldownMap"
import { buildRegionIndex } from "@/blocks/InteractiveMap/drilldown/regions"
import { interactivePath } from "@/collections/InteractiveSnapshots/tag"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import RichText from "@/components/RichText"
import { loadInteractiveOverview, queryInteractiveBySlug } from "@/interactives/load"
import { generateMeta } from "@/utilities/generateMeta"

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const payload = await getPayload({ config: configPromise })
  const interactives = await payload.find({
    collection: "interactives",
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: { slug: true },
  })
  return interactives.docs.map(({ slug }) => ({ slug }))
}

interface Args {
  params: Promise<{ slug?: string }>
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = "" } = await paramsPromise
  const interactive = await queryInteractiveBySlug(slug)
  return generateMeta({ doc: interactive, canonicalPath: interactivePath(slug) })
}

/**
 * A long-lived interactive page. The editorial frame — title, standfirst, sources — comes
 * from the `interactives` document; the map comes from the code-owned profile it names and
 * the published snapshot of its data feed (the newest draft in preview). Regions load lazily
 * from `./regions/[regionId]`, composed the same way.
 */
export default async function InteractivePage({
  params: paramsPromise,
}: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug = "" } = await paramsPromise
  const url = interactivePath(slug)
  const interactive = await queryInteractiveBySlug(slug)

  if (!interactive) return <PayloadRedirects url={url} />

  const composed = await loadInteractiveOverview(interactive)

  return (
    // The same named size container the article page provides, so the drilldown figure
    // breaks out of the prose column to the site container's width (see the block's styles).
    <div className="@container/page">
      <article className="mx-auto max-w-2xl space-y-6 px-4 md:px-1">
        <PayloadRedirects disableNotFound url={url} />
        {draft && <LivePreviewListener />}

        <header className="space-y-4 pt-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
            {interactive.title}
          </h1>
          {interactive.intro && (
            <div className="text-muted-foreground text-lg">
              <RichText data={interactive.intro} enableGutter={false} />
            </div>
          )}
        </header>

        {composed ? (
          <DrilldownMap
            widgetTitle={null}
            sources={interactive.sources}
            resolved={{
              overview: composed.overview,
              regions: buildRegionIndex([composed.overview]),
              childAssets: composed.childAssets,
              problems: composed.problems,
            }}
          />
        ) : (
          <p
            data-interactive-empty
            className="border-border text-muted-foreground my-8 rounded-sm border border-dashed p-6 text-center text-sm"
          >
            {draft
              ? "No data snapshot has been synced for this interactive yet. Run the sync from Interactive Snapshots in the admin, then reload this preview."
              : "This interactive has no published data yet."}
          </p>
        )}
      </article>
    </div>
  )
}
