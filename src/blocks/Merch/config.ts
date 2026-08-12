import type { Block } from "payload"

/**
 * Merch — showcases products from the DGG store as an on-site placement.
 *
 * Two layouts:
 *  - `square`    — compact, for sidebars / narrow columns
 *  - `fullWidth` — banner-style, for page bodies
 *
 * The block stores a *query*, never product data: products live in the
 * `merch-products` collection, synced hourly from Shopify. That's what keeps a
 * price change or a sold-out item from being a manual edit in every placement.
 */
export const Merch: Block = {
  slug: "merch",
  interfaceName: "MerchBlock",
  labels: {
    singular: "Merch",
    plural: "Merch",
  },
  fields: [
    {
      name: "heading",
      type: "text",
      defaultValue: "The Pragmatic Papers Store",
    },
    {
      name: "layout",
      type: "select",
      defaultValue: "fullWidth",
      options: [
        { label: "Square (sidebar)", value: "square" },
        { label: "Full width (page)", value: "fullWidth" },
      ],
      admin: {
        description: "Square suits narrow sidebars; full width suits page bodies.",
      },
    },
    {
      name: "autoplay",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "Advance the carousel on its own. Pauses on hover, on focus, and after the reader takes over; ignored for readers who prefer reduced motion.",
      },
    },
    {
      name: "source",
      type: "select",
      defaultValue: "all",
      options: [
        { label: "All synced products", value: "all" },
        { label: "Filtered selection", value: "filtered" },
      ],
      admin: {
        description:
          "Products are synced from Shopify hourly. Show the whole catalogue, or narrow it down below.",
      },
    },
    {
      name: "collection",
      type: "text",
      admin: {
        condition: (_, siblingData) => siblingData?.source === "filtered",
        description:
          'Shopify collection handle — the store\'s own grouping, e.g. "apparel". Leave blank to ignore.',
      },
    },
    {
      name: "tag",
      type: "text",
      admin: {
        condition: (_, siblingData) => siblingData?.source === "filtered",
        description: 'Store product tag, e.g. "new-release". Leave blank to ignore.',
      },
    },
    {
      name: "featuredOnly",
      type: "checkbox",
      defaultValue: false,
      admin: {
        condition: (_, siblingData) => siblingData?.source === "filtered",
        description: 'Only products marked "featured" in Merch.',
      },
    },
    {
      name: "selectedProducts",
      type: "relationship",
      relationTo: "merch",
      hasMany: true,
      admin: {
        condition: (_, siblingData) => siblingData?.source === "filtered",
        description:
          "Pick exact products. They display in the order arranged here, ignoring the sort below.",
      },
    },
    {
      name: "orderBy",
      type: "select",
      defaultValue: "sortOrder",
      options: [
        { label: "Sort order", value: "sortOrder" },
        { label: "Title (A–Z)", value: "title" },
        { label: "Newest first", value: "newest" },
      ],
      admin: {
        description: "Sort order uses the number set on each product in Merch.",
      },
    },
    {
      name: "limit",
      type: "number",
      defaultValue: 12,
      min: 1,
      max: 24,
      admin: {
        description: "Most products to pull into the carousel.",
      },
    },
    {
      name: "storeUrl",
      type: "text",
      admin: {
        description: "Optional override for the “Shop all” button. Defaults to the DGG merch page.",
      },
    },
  ],
}
