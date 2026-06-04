import type { Block } from "payload"

export const InteractiveMap: Block = {
  slug: "interactiveMap",
  interfaceName: "InteractiveMapBlock",
  labels: {
    singular: "Interactive Map",
    plural: "Interactive Maps",
  },
  fields: [
    {
      name: "widgetTitle",
      type: "text",
      label: "Widget Title",
      admin: {
        description: "Optional heading displayed above the map(s).",
      },
    },
    {
      name: "layout",
      type: "select",
      defaultValue: "row",
      required: true,
      options: [
        { label: "Side by side (row)", value: "row" },
        { label: "Grid (wraps on narrow screens)", value: "grid" },
      ],
    },
    {
      name: "colorScale",
      type: "select",
      defaultValue: "divergingRedBlue",
      required: true,
      label: "Color Scale",
      options: [
        {
          label: "Diverging Red/Blue — election margin (R+/D+)",
          value: "divergingRedBlue",
        },
        {
          label: "Per-region custom colors (no automatic fill)",
          value: "perRegion",
        },
      ],
      admin: {
        description:
          "Diverging Red/Blue colors each region by its value (negative = D+, positive = R+). Per-region uses the color you set on each region row.",
      },
    },
    {
      name: "maps",
      type: "array",
      label: "Maps",
      labels: { singular: "Map", plural: "Maps" },
      required: true,
      minRows: 1,
      fields: [
        {
          name: "title",
          type: "text",
          label: "Map Title",
        },
        {
          name: "svg",
          type: "textarea",
          required: true,
          label: "Pre-projected SVG",
          admin: {
            description:
              "Paste an SVG whose paths are already projected (e.g. Albers Equal Area). Each region path must carry a data attribute (default: data-region) that matches a Region ID below.",
            rows: 6,
          },
        },
        {
          name: "regionAttribute",
          type: "text",
          defaultValue: "data-region",
          label: "Region Attribute",
          admin: {
            description:
              "The data attribute on each path that identifies the region (e.g. data-region, data-district).",
          },
        },
        {
          name: "regions",
          type: "array",
          label: "Regions",
          labels: { singular: "Region", plural: "Regions" },
          fields: [
            {
              name: "regionId",
              type: "text",
              required: true,
              label: "Region ID",
              admin: {
                description: "Must match the value of the region attribute on the SVG path.",
              },
            },
            {
              name: "label",
              type: "text",
              label: "Tooltip Label",
            },
            {
              name: "value",
              type: "number",
              label: "Value",
              admin: {
                description:
                  "For Diverging Red/Blue: signed margin (positive = R+, negative = D+).",
              },
            },
            {
              name: "color",
              type: "text",
              label: "Override Color (optional)",
              admin: {
                description: "CSS color. Overrides the automatic color scale for this region.",
              },
            },
          ],
        },
      ],
    },
    {
      name: "sources",
      type: "array",
      label: "Sources / Attribution",
      labels: { singular: "Source", plural: "Sources" },
      admin: {
        description: "Shown as a small attribution footer beneath the maps.",
      },
      fields: [
        { name: "name", type: "text", required: true },
        { name: "url", type: "text" },
      ],
    },
  ],
}
