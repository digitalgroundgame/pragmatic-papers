import { draftMode } from "next/headers"
import React from "react"

import { Sources } from "@/blocks/InteractiveMap/Sources"
import RichText from "@/components/RichText"
import { Separator } from "@/components/ui/separator"
import type { Interactive } from "@/payload-types"

import { loadWhipCount } from "./load"
import { WhipCount } from "./WhipCount"

/**
 * The body of a whip count interactive's page, under its breadcrumbs: the editor's title,
 * standfirst and methodology from the `interactives` document, and the count from its
 * snapshot, which the reader can redraft in their browser.
 */
export async function WhipCountPage({
  interactive,
}: {
  interactive: Interactive
}): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const parsed = await loadWhipCount(interactive)

  return (
    <>
      <header className="max-w-3xl">
        <p className="text-brand-text font-serif text-xs font-semibold tracking-widest uppercase">
          Interactive
        </p>
        {/* The title is in the site's display face; the count below sets its headings in the body sans. */}
        <h1 className="mt-2">{interactive.title}</h1>
        <RichText data={interactive.intro} enableGutter={false} className="mt-4 text-lg" />
      </header>

      <Separator className="my-6" />

      {parsed.success ? (
        <WhipCount title={interactive.title} data={parsed.value} storageKey={interactive.slug} />
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

      {interactive.methodology && (
        <section className="text-muted-foreground mt-10 max-w-3xl text-sm">
          <h2 className="text-foreground font-sans text-base leading-tight font-semibold tracking-normal">
            How this is counted
          </h2>
          <p className="mt-2 whitespace-pre-line">{interactive.methodology}</p>
        </section>
      )}

      <Sources sources={interactive.sources} className="mt-4" />
    </>
  )
}
