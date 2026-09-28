import type { Block } from "payload"
import { layouts, slotCounts, slotDescriptions } from "./helpers/layouts"
import { validateSlots } from "./hooks/validateSlots"
import type { LayoutDefinition } from "./types"

export type { LayoutDefinition }

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
      validate: validateSlots,
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
