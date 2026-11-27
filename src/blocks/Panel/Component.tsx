import React from "react"

import {
  ContributorsPanel,
  LatestVolumePanel,
  MostReadPanel,
  NewsletterPanel,
  RelatedTopicsPanel,
  SearchTipsPanel,
  TopicsPanel,
} from "@/components/Aside"
import type { PanelBlock as PanelBlockProps } from "@/payload-types"

import type { PanelSource } from "./config"

/** What the page around an aside tells its panels. */
export interface PanelContext {
  /** The topic a topic page lists. Panels about one topic show nothing without it. */
  topicId?: number
}

/**
 * How each panel source renders. Keyed by every source the block offers, so a source added
 * to `PANEL_SOURCES` fails the type check until it's here.
 */
const PANEL_RENDERERS: {
  [Source in PanelSource]: (
    title: string | null | undefined,
    context: PanelContext,
  ) => React.ReactNode
} = {
  mostRead: (title, { topicId }) => <MostReadPanel title={title} topicId={topicId} />,
  latestVolume: (title) => <LatestVolumePanel title={title} />,
  topics: (title) => <TopicsPanel title={title} />,
  relatedTopics: (title, { topicId }) =>
    topicId ? <RelatedTopicsPanel title={title} topicId={topicId} /> : null,
  contributors: (title, { topicId }) =>
    topicId ? <ContributorsPanel title={title} topicId={topicId} /> : null,
  searchTips: (title) => <SearchTipsPanel title={title} />,
  newsletter: (title) => <NewsletterPanel title={title} />,
}

export function PanelBlock({
  source,
  title,
  context = {},
}: Pick<PanelBlockProps, "source" | "title"> & { context?: PanelContext }): React.ReactNode {
  return PANEL_RENDERERS[source]?.(title, context) ?? null
}

/** An aside's panels, in the order an editor gave them. */
export function RenderPanels({
  panels,
  context,
}: {
  panels: readonly Pick<PanelBlockProps, "source" | "title" | "id">[] | null | undefined
  context?: PanelContext
}): React.ReactNode {
  return (panels ?? []).map((panel, i) => (
    <PanelBlock key={panel.id ?? i} source={panel.source} title={panel.title} context={context} />
  ))
}

/** Whether an aside has any panels to render. */
export const hasPanels = (panels: readonly unknown[] | null | undefined): boolean =>
  Boolean(panels?.length)
