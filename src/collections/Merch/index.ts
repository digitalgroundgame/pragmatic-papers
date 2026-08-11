import type { CollectionConfig } from "payload"

import { admin } from "@/access/collections"
import {
  revalidateMerchProduct,
  revalidateMerchProductDelete,
} from "./hooks/revalidateMerchProducts"

/**
 * Merch — the local mirror of the DGG store catalogue.
 *
 * Rows are written by the `syncShopifyProducts` job, not by hand: the store
 * owns every commerce field here, so they render read-only in the admin. The
 * editorial fields at the bottom are ours — a sync never overwrites them, so
 * curating a product survives the next run.
 *
 * Fields are named for the commerce concept rather than the vendor, and each
 * one is a leaf value copied as the store reports it. This is a derived cache:
 * a field we skipped can be added as a column and backfilled by the next run,
 * which is why there's no raw payload kept alongside.
 *
 * Products are never hard-deleted. One that unpublishes or disappears from
 * Shopify flips to `archived`, so a Merch block pointing at it degrades to
 * "not shown" instead of a dangling reference.
 */
export const Merch: CollectionConfig = {
  slug: "merch",
  labels: {
    singular: "Merch Product",
    plural: "Merch",
  },
  access: {
    create: admin,
    delete: admin,
    update: admin,
    // Public read, but only the products Shopify still lists. Staff see
    // everything, including archived rows, so a vanished product is
    // diagnosable in the admin.
    read: ({ req: { user } }) => {
      if (user) return true
      return { status: { equals: "active" } }
    },
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "price", "availableForSale", "status", "lastSyncedAt"],
    description:
      "Synced hourly from Shopify and stored as Shopify reports it — prices are raw amounts, not formatted strings, and the block decides how they read. Commerce fields are read-only; edit them in Shopify. The presentation fields at the bottom are ours and survive a sync.",
    group: "Store",
  },
  hooks: {
    afterChange: [revalidateMerchProduct],
    afterDelete: [revalidateMerchProductDelete],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: { readOnly: true },
    },
    {
      name: "externalId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: "The store's own product ID — the key each sync upserts on.",
      },
    },
    {
      name: "source",
      type: "select",
      defaultValue: "shopify",
      index: true,
      options: [{ label: "Shopify", value: "shopify" }],
      admin: {
        readOnly: true,
        description:
          "Which storefront this product was synced from. Every field here is a generic commerce concept, so a second source would add an option and its own sync task rather than a second collection.",
      },
    },
    {
      name: "handle",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Shopify's URL handle. The link we render is derived from this, so a rename in Shopify is picked up by the next sync.",
      },
    },
    {
      name: "description",
      type: "textarea",
      admin: { readOnly: true },
    },
    {
      type: "row",
      fields: [
        {
          name: "price",
          type: "text",
          admin: {
            readOnly: true,
            width: "33%",
            description: "Minimum variant price, as a decimal string.",
          },
        },
        {
          name: "compareAtPrice",
          type: "text",
          admin: { readOnly: true, width: "33%" },
        },
        {
          name: "currencyCode",
          type: "text",
          admin: { readOnly: true, width: "33%" },
        },
      ],
    },
    {
      name: "availableForSale",
      type: "checkbox",
      admin: {
        readOnly: true,
        description: 'As Shopify reports it. The block turns this into the "Sold Out" badge.',
      },
    },
    {
      name: "imageUrl",
      type: "text",
      admin: {
        readOnly: true,
        description: "Shopify CDN URL. Rendered directly — we don't copy product shots locally.",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "imageWidth",
          type: "number",
          admin: { readOnly: true, width: "33%" },
        },
        {
          name: "imageHeight",
          type: "number",
          admin: { readOnly: true, width: "33%" },
        },
        {
          name: "imageAlt",
          type: "text",
          admin: { readOnly: true, width: "33%" },
        },
      ],
    },
    {
      name: "tags",
      type: "text",
      hasMany: true,
      index: true,
      admin: {
        readOnly: true,
        description: "Shopify product tags. Merch blocks can filter on these.",
      },
    },
    {
      name: "categories",
      type: "text",
      hasMany: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Handles of the store groupings this product belongs to — Shopify calls these collections, but that word already means something else here.",
      },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
      admin: {
        readOnly: true,
        description:
          "Archived means Shopify stopped listing it. Archived products are never shown.",
      },
    },
    {
      name: "lastSyncedAt",
      type: "date",
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
        description:
          "When the last sync last saw this product. A stale date means the job stopped running.",
      },
    },
    {
      type: "collapsible",
      label: "Presentation (ours — never overwritten by a sync)",
      fields: [
        {
          name: "featured",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: 'Merch blocks set to "featured only" show these.',
          },
        },
        {
          name: "hidden",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: "Keep this product out of every Merch block without touching Shopify.",
          },
        },
        {
          name: "badgeOverride",
          type: "text",
          maxLength: 20,
          admin: {
            description:
              'Replaces the automatic badge, e.g. "Last few" instead of the derived "Sold Out".',
          },
        },
        {
          name: "sortOrder",
          type: "number",
          admin: {
            description: "Lower sorts first when a block orders by sort order. Blank sorts last.",
          },
        },
      ],
    },
  ],
}
