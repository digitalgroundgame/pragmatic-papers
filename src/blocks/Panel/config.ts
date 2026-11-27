import type { Block } from "payload"

import { blockImages } from "@/blocks/blockImages"

/**
 * What a panel can show. Each one's list comes from the site itself (the week's views, the
 * topics' article counts), so editors choose and order panels, and retitle them, but don't
 * fill them. A new source is code: add it here and to `PANEL_RENDERERS`.
 */
export const PANEL_SOURCES = [
  { label: "Most read this week", value: "mostRead" },
  { label: "Latest volume", value: "latestVolume" },
  { label: "Browse topics", value: "topics" },
  { label: "Often paired with (topic pages)", value: "relatedTopics" },
  { label: "Who writes on this (topic pages)", value: "contributors" },
  { label: "Search tips", value: "searchTips" },
  { label: "Newsletter signup", value: "newsletter" },
] as const

export type PanelSource = (typeof PANEL_SOURCES)[number]["value"]

/**
 * One panel in a page's aside. Defined once at the top of the Payload config (`blocks`) and
 * referenced by slug wherever an aside is edited (`blockReferences: ["panel"]`): the Pages
 * aside, and each tab of the Layouts global.
 */
export const Panel: Block = {
  slug: "panel",
  interfaceName: "PanelBlock",
  labels: { singular: "Panel", plural: "Panels" },
  admin: {
    images: blockImages("panel"),
    disableBlockName: true,
    components: { Label: "@/blocks/Panel/BlockLabel#PanelBlockLabel" },
  },
  fields: [
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "mostRead",
      options: [...PANEL_SOURCES],
      admin: {
        description:
          "What the panel lists. The site keeps it current. A panel with nothing to show (no views this week, a topic with no other topics) is left out.",
      },
    },
    {
      name: "title",
      type: "text",
      admin: { description: "Leave empty for the panel's usual heading." },
    },
  ],
}
