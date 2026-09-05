import type { Block } from "payload"

import { link } from "@/fields/link2"

type SiblingData = { mode?: string } | undefined

// `mode` did not exist before the drilldown mode landed, so an unset value is a choropleth.
const isChoropleth = (_: unknown, siblingData: SiblingData): boolean =>
  siblingData?.mode !== "drilldown"
const isDrilldown = (_: unknown, siblingData: SiblingData): boolean =>
  siblingData?.mode === "drilldown"

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
      name: "mode",
      type: "select",
      defaultValue: "choropleth",
      required: true,
      options: [
        { label: "Choropleth — regions shaded by a value", value: "choropleth" },
        { label: "Drilldown — overview map with lazy-loaded region detail", value: "drilldown" },
      ],
      admin: {
        description:
          "Choropleth colors one or more maps by a numeric value. Drilldown shows one overview map whose regions open into their child regions and records; the child geometry and records load only when a reader drills in.",
      },
    },
    {
      name: "layout",
      type: "select",
      defaultValue: "row",
      required: true,
      options: [
        { label: "Side by side (horizontal)", value: "row" },
        { label: "Stacked on top of each other (vertical)", value: "stacked" },
      ],
      admin: { condition: isChoropleth },
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
        condition: isChoropleth,
        description:
          "Diverging Red/Blue colors each region by its value (negative = D+, positive = R+). Per-region uses the color you set on each region row.",
      },
    },
    {
      name: "colorBias",
      type: "number",
      label: "Color Bias",
      defaultValue: 1,
      admin: {
        condition: isChoropleth,
        description:
          "Warps the color breakpoints along a curve between ±1 (neutral) and ±100 (max). Above 1 = breakpoints shift toward the low end, so small margins get strong colors. Below 1 = breakpoints shift toward the high end, requiring larger margins for strong colors. Default: 1 (linear).",
        step: 0.1,
      },
    },
    {
      name: "maps",
      type: "array",
      label: "Maps",
      labels: { singular: "Map", plural: "Maps" },
      required: true,
      minRows: 1,
      // Payload skips validation for a field whose condition is false, so a drilldown block
      // saves without any choropleth maps.
      admin: { condition: isChoropleth },
      fields: [
        {
          name: "title",
          type: "text",
          label: "Title",
        },
        {
          name: "svgAsset",
          type: "upload",
          relationTo: "map-assets",
          required: true,
          label: "Pre-projected SVG",
          admin: {
            description:
              "Upload an SVG whose paths are already projected (e.g. Albers Equal Area). Each region path must carry an id attribute that matches a Region ID below.",
          },
        },
        {
          name: "dataAttribute",
          type: "text",
          label: "Data Attribute",
          admin: {
            description:
              "The data attribute on each path that holds the numeric value for the color scale (e.g. data-margin). When set, values are read directly from the SVG — no need to enter them manually in the Overrides table.",
          },
        },
        {
          name: "overrides",
          type: "array",
          label: "Overrides",
          labels: { singular: "Override", plural: "Overrides" },
          fields: [
            {
              name: "regionId",
              type: "text",
              required: true,
              label: "Region ID",
              admin: {
                description: "Must match the id attribute on the SVG path.",
              },
            },
            {
              name: "label",
              type: "text",
              label: "Override Label (optional)",
            },
            {
              name: "value",
              type: "number",
              label: "Override Value (optional)",
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
        {
          name: "invertColors",
          type: "checkbox",
          label: "Invert Colors",
          defaultValue: false,
          admin: {
            hidden: true,
            description:
              "Flip the color scale polarity for this map (positive values get the negative palette and vice versa).",
          },
        },
      ],
    },
    {
      name: "drilldown",
      type: "group",
      label: "Drilldown",
      admin: {
        condition: isDrilldown,
        description:
          "The overview SVG's paths carry region facts as data-* attributes; each region asset's <metadata> carries the records shown when a reader drills into that region. See the interactive-maps skill for the asset contract and validator.",
      },
      fields: [
        {
          name: "overviewAsset",
          type: "upload",
          relationTo: "map-assets",
          required: true,
          label: "Overview SVG",
          admin: {
            description:
              "Pre-projected SVG of the parent regions (with child borders if you want them drawn). Each region path needs an id; data-region-label, data-parent-id, data-layer and data-inset are reserved, every other data-* is shown as a fact.",
          },
        },
        {
          name: "regionAssets",
          type: "array",
          label: "Region Assets",
          labels: { singular: "Region Asset", plural: "Region Assets" },
          admin: {
            description:
              "One SVG per drillable region: that region's children in their own projection, plus the region's records in a <metadata> JSON payload. Loaded only when a reader drills in.",
          },
          fields: [
            {
              name: "regionId",
              type: "text",
              required: true,
              label: "Region ID",
              admin: {
                description:
                  "Must match the id of a region path in the overview SVG (or a region declared in its <metadata>).",
              },
            },
            {
              name: "svgAsset",
              type: "upload",
              relationTo: "map-assets",
              required: true,
              label: "Region SVG",
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
        link({
          label: "Source",
          component: {
            type: { defaultValue: "custom" },
            label: { label: "Name" },
            variant: { admin: { hidden: true } },
          },
        }),
      ],
    },
  ],
}
