import configPromise from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React from "react"

import { Sources } from "@/blocks/InteractiveMap/Sources"
import { interactivePath } from "@/collections/InteractiveSnapshots/tag"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import RichText from "@/components/RichText"
import { Separator } from "@/components/ui/separator"
import { InteractiveDrilldown } from "@/interactives/InteractiveDrilldown"
import { loadInteractiveOverview, queryInteractiveBySlug } from "@/interactives/load"
import { getProfile } from "@/interactives/profiles"
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

const dataDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

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
  const profile = getProfile(interactive.profile)
  const summary = composed?.summary != null ? profile?.summary?.render(composed.summary) : undefined

  return (
    <div className="container pt-8 pb-16">
      <PayloadRedirects disableNotFound url={url} />
      {draft && <LivePreviewListener />}

      <header className="max-w-3xl">
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          Interactive
        </p>
        <h1 className="mt-2">{interactive.title}</h1>
        {interactive.intro && (
          <RichText data={interactive.intro} enableGutter={false} className="mt-4" />
        )}
        {composed && (
          <p data-interactive-meta="" className="text-muted-foreground mt-4 text-sm">
            Data as of{" "}
            <time dateTime={composed.generatedAt}>
              {dataDate.format(new Date(composed.generatedAt))}
            </time>
            {" · "}synced from {composed.source.name}
            {composed.metaLine ? ` · ${composed.metaLine}` : ""}
          </p>
        )}
      </header>

      <Separator className="my-6" />

      {composed ? (
        <InteractiveDrilldown
          composed={composed}
          emptyHint="Select a court on the map or from the list to see who sits on its bench."
          searchLabel="Search judges"
          summary={summary}
        />
      ) : (
        <p
          data-interactive-empty
          className="border-border text-muted-foreground my-8 rounded-lg border border-dashed p-8 text-center text-sm"
        >
          {draft
            ? "No data snapshot has been synced for this interactive yet. Run the sync from Interactive Snapshots in the admin, then reload this preview."
            : "This interactive has no published data yet."}
        </p>
      )}

      <Sources sources={interactive.sources} colorBias={null} className="mt-4" />
    </div>
  )
}
