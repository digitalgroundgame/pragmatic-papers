import type { Block } from "payload"
import { BernoulliLeft } from "./layouts/BernoulliLeft"
import { BernoulliRight } from "./layouts/BernoulliRight"
import { Euler2 } from "./layouts/Euler2"
import { Euler3 } from "./layouts/Euler3"
import { Euler5 } from "./layouts/Euler5"
import { Fibonacci6 } from "./layouts/Fibonacci6"
import { Fibonacci7 } from "./layouts/Fibonacci7"
import { Newton4 } from "./layouts/Newton4"
import { Vespucci7 } from "./layouts/Vespucci7"
import type { LayoutDefinition } from "./types"

export type { LayoutDefinition }

type Layout =
  | "bernoulli-left"
  | "bernoulli-right"
  | "euler-2"
  | "euler-3"
  | "newton-4"
  | "euler-5"
  | "fibonacci-6"
  | "vespucci-7"
  | "fibonacci-7"

export const layouts = {
  "bernoulli-left": BernoulliLeft,
  "bernoulli-right": BernoulliRight,
  "euler-2": Euler2,
  "euler-3": Euler3,
  "newton-4": Newton4,
  "euler-5": Euler5,
  "fibonacci-6": Fibonacci6,
  "vespucci-7": Vespucci7,
  "fibonacci-7": Fibonacci7,
} as const satisfies Record<Layout, LayoutDefinition>

const slotCounts: Record<string, number> = Object.fromEntries(
  Object.entries(layouts).map(([key, { slotDescriptions }]) => [key, slotDescriptions.length]),
)

const slotDescriptions: Record<string, string[]> = Object.fromEntries(
  Object.entries(layouts).map(([key, def]) => [key, def.slotDescriptions]),
)

export const CollectionGrid: Block = {
  slug: "collectionGrid",
  interfaceName: "CollectionGridBlock",
  labels: { singular: "Collection Grid", plural: "Collection Grids" },
  fields: [
    {
      name: "layout",
      type: "select",
      interfaceName: "CollectionGridLayout",
      label: "Layout Preset",
      required: false,
      options: Object.entries(layouts).map(([value, { label }]) => ({
        value,
        label,
      })),
      admin: {
        description: "Choose a layout preset that determines how article slots are arranged.",
        components: {
          Field: {
            path: "@/blocks/CollectionGrid/components/LayoutSelectField#LayoutSelectField",
            clientProps: {
              slotCounts,
            },
          },
        },
      },
    },
    {
      name: "slots",
      type: "array",
      label: "Slots",
      interfaceName: "CollectionGridSlots",
      required: true,
      admin: {
        description:
          "Fill each slot with a article or volume. The number of slots is determined by the chosen layout.",
        components: {
          Field: {
            path: "@/blocks/CollectionGrid/components/SlotsField#SlotsField",
            clientProps: {
              slotCounts,
            },
          },
          RowLabel: {
            path: "@/blocks/CollectionGrid/components/SlotRowLabel#SlotRowLabel",
            clientProps: {
              slotDescriptions,
            },
          },
        },
      },
      fields: [
        {
          name: "collection",
          type: "relationship",
          relationTo: ["articles", "volumes"],
          label: "Article or Volume",
          admin: {
            sortOptions: {
              articles: "-publishedAt",
              volumes: "-volumeNumber",
            },
          },
          required: true,
          filterOptions: { _status: { equals: "published" } },
        },
        {
          type: "row",
          fields: [
            {
              name: "kicker",
              type: "text",
              label: "Kicker",
              admin: {
                description: 'Optional short label above the title (e.g. "Breaking", "Opinion")',
              },
            },
            {
              name: "showByline",
              type: "checkbox",
              label: "Show Byline",
              defaultValue: false,
              admin: {
                description: "Show the author names for this slot",
              },
            },
          ],
        },
        {
          name: "overrideTitle",
          type: "text",
          label: "Override Title",
          admin: {
            description: "Optional override for the title in this slot",
          },
        },
      ],
    },
  ],
}
