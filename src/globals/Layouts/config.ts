import type { BlocksField, GlobalConfig } from "payload"

import { isEditor } from "@/access/roles"
import type { PanelBlock } from "@/payload-types"

import { revalidateLayouts } from "./hooks/revalidateLayouts"

type PanelDefault = Pick<PanelBlock, "blockType" | "source">

/** The panels each template's aside showed before editors could choose them. */
export const DEFAULT_ASIDES = {
  topic: [
    { blockType: "panel", source: "mostRead" },
    { blockType: "panel", source: "contributors" },
    { blockType: "panel", source: "relatedTopics" },
    { blockType: "panel", source: "newsletter" },
  ],
  article: [
    { blockType: "panel", source: "mostRead" },
    { blockType: "panel", source: "latestVolume" },
    { blockType: "panel", source: "topics" },
  ],
} as const satisfies Record<string, readonly PanelDefault[]>

/** An aside: Panel blocks, defined once in the Payload config and referenced here by slug. */
export function asideField({
  defaultValue,
  description,
  ...field
}: Partial<Omit<BlocksField, "type" | "blocks" | "blockReferences">> & {
  description?: string
}): BlocksField {
  return {
    name: "aside",
    label: "Aside",
    labels: { singular: "Panel", plural: "Panels" },
    type: "blocks",
    blocks: [],
    blockReferences: ["panel"],
    maxRows: 6,
    // Blocks fields don't type their defaults; the panels are plain data.
    defaultValue: defaultValue as BlocksField["defaultValue"],
    ...field,
    admin: { initCollapsed: true, ...field.admin, description },
  }
}

/**
 * How each template lays out what's around its content: today, the panels in its aside. A
 * tab per template (Topic, Article), so a template's next editable part (its hero layout, the
 * order of its slots) lands in the same place. Until an editor saves it, each aside reads its
 * `defaultValue`, the panels the template showed when they were code.
 */
export const Layouts: GlobalConfig = {
  slug: "layouts",
  label: "Layouts",
  access: {
    read: () => true,
    update: ({ req: { user } }) => isEditor(user),
  },
  admin: {
    group: "Site",
    description: "The parts of each template that aren't any one document's.",
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          name: "topic",
          label: "Topic",
          admin: { description: "Every topic page: /topics/<topic>." },
          fields: [
            asideField({
              defaultValue: DEFAULT_ASIDES.topic,
              description:
                "Beside the topic's articles, below them on phones. A topic can replace these with its own.",
            }),
          ],
        },
        {
          name: "article",
          label: "Article",
          admin: { description: "Every article page." },
          fields: [
            asideField({
              defaultValue: DEFAULT_ASIDES.article,
              description: "At the end of the article, beside the recommended articles.",
            }),
          ],
        },
      ],
    },
  ],
  hooks: { afterChange: [revalidateLayouts] },
}
