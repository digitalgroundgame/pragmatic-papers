import type { Block } from "payload"

/**
 * Merch — showcases products from an external store as an on-site ad placement.
 *
 * Two layouts:
 *  - `square`    — compact, for sidebars / narrow columns
 *  - `fullWidth` — banner-style, for page bodies
 *
 * Products are curated by editors today. The block is structured so a live
 * storefront API source can be layered in later without changing the component
 * contract — see `getMerchProducts` in `./products` for the seam.
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
      name: "storeUrl",
      type: "text",
      defaultValue: "https://pragmaticpapers.org/store",
      admin: {
        description: "Link to the full store, shown as a “Shop all” button.",
      },
    },
    {
      name: "products",
      type: "array",
      minRows: 1,
      maxRows: 6,
      labels: {
        singular: "Product",
        plural: "Products",
      },
      admin: {
        initCollapsed: true,
        description: "Curate the products to feature. Reorder to control display order.",
        components: {
          RowLabel: "@/blocks/Merch/ProductRowLabel#ProductRowLabel",
        },
      },
      fields: [
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          required: true,
        },
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "price",
          type: "text",
          admin: {
            description: "Optional, e.g. “$25.00”.",
          },
        },
        {
          name: "badge",
          type: "text",
          maxLength: 20,
          admin: {
            description: "Optional pill on the product image, e.g. “New” or “Sold out”.",
          },
        },
        {
          name: "url",
          type: "text",
          required: true,
          admin: {
            description: "Link to the product on the store.",
          },
        },
      ],
    },
  ],
}
