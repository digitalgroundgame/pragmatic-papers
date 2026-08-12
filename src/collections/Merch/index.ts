import type { CollectionConfig, PayloadRequest } from "payload"

import { admin } from "@/access/collections"
import { isAdmin } from "@/access/roles"
import { readShopifyEnv } from "@/jobs/syncShopifyProducts/logic"
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
 * One name does double duty: the `collections` field holds Shopify collection
 * handles — the store's own product groupings, what a shopper sees as a
 * category — and has nothing to do with Payload collections like this one. It
 * keeps Shopify's name so a row can be read against the Storefront response
 * without translating, and because Shopify separately uses "category" for its
 * product taxonomy, which is a different thing we may want that name for.
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
    // Nobody hand-creates a merch product: rows come from the sync, which
    // writes through the Local API and bypasses access control. A hand-made
    // row has no real store ID to match on, so the next run would archive it
    // immediately. Denying create is what removes Payload's "Create New"
    // button and the empty-state prompt along with it.
    create: () => false,
    delete: admin,
    // Editors need this for the presentation fields at the bottom.
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
    components: {
      // The hourly job covers the ordinary case; this is for the editor who
      // just pushed a drop to Shopify.
      beforeListTable: ["@/collections/Merch/components/SyncNowButton#SyncNowButton"],
    },
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
  endpoints: [
    {
      // Mounted at /api/merch/sync. This has to be a collection endpoint
      // rather than a root one: root endpoints are matched after collection
      // routes, so anything under /api/merch is swallowed by this
      // collection's own REST namespace and 404s.
      //
      // The scheduled sync runs hourly; this is for the editor who has just
      // pushed a drop to Shopify and wants it on the site now.
      path: "/sync",
      method: "post",
      handler: async (req: PayloadRequest): Promise<Response> => {
        if (!isAdmin(req.user)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 })
        }
        const job = await req.payload.jobs.queue({ task: "syncShopifyProducts", input: {} })
        const result = await req.payload.jobs.run({ queue: "default", limit: 1 })
        // A run without credentials is a logged no-op, not a failure — say so,
        // or the admin button reports success over an empty catalogue.
        return Response.json({ jobId: job.id, configured: readShopifyEnv() !== null, result })
      },
    },
  ],
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
      // Shopify's own name for these, kept so a row lines up with the
      // Storefront response field for field. Note this is a plain list of
      // handles, not a Payload relationship — see the note at the top of this
      // file on the two meanings of "collection".
      name: "collections",
      type: "text",
      hasMany: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Handles of the Shopify collections (the store's product groupings) this product belongs to, e.g. \"apparel\". Shopify's term for a category — nothing to do with Payload collections. A Merch block can filter on one.",
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
