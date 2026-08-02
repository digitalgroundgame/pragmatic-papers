import type { Block } from "payload"

/**
 * ShopifyMerch — showcases products from the DiGG Shopify store as an
 * on-site ad placement.
 *
 * Two layouts:
 *  - `square`    — compact, for sidebars / narrow columns
 *  - `fullWidth` — banner-style, for page bodies
 *
 * Products are curated by editors today. The block is structured so a live
 * Shopify Storefront API source can be layered in later without changing the
 * component contract — see `getMerchProducts` in `./products` for the seam.
 */
export const ShopifyMerch: Block = {
  slug: "shopifyMerch",
  interfaceName: "ShopifyMerchBlock",
  labels: {
    singular: "Shopify Merch",
    plural: "Shopify Merch",
  },
  fields: [
    {
      name: "heading",
      type: "text",
      defaultValue: "From the DiGG Store",
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
      name: "storeUrl",
      type: "text",
      defaultValue: "https://store.digitalgroundgame.org/",
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
          name: "url",
          type: "text",
          required: true,
          admin: {
            description: "Link to the product on the Shopify store.",
          },
        },
      ],
    },
  ],
}
