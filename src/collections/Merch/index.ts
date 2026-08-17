import type { CollectionConfig, FieldAccess, PayloadRequest } from "payload"

import { admin } from "@/access/collections"
import { isAdmin } from "@/access/roles"
import { readShopifyEnv } from "@/jobs/syncShopifyProducts/logic"
import {
  revalidateMerchProduct,
  revalidateMerchProductDelete,
} from "./hooks/revalidateMerchProducts"

/**
 * Denies every write to a store-owned field, for everyone.
 *
 * `admin.readOnly` looked like it did this, and doesn't: it greys the input in
 * the edit view and nothing more. The bulk-edit drawer still listed the field
 * and happily saved it, and the REST and GraphQL APIs never consulted it at
 * all — it's presentation, not a permission. Field access is the rule the
 * server actually enforces, on every operation and every transport.
 *
 * The sync is unaffected: it writes through the Local API with
 * `overrideAccess: true`, which is the point of the flag being there.
 */
const storeOwned: FieldAccess = () => false

/**
 * The admin half of the same rule. `readOnly` greys the field in the edit
 * view; `disableBulkEdit` keeps it out of the bulk-edit field picker, which
 * ignores `readOnly` and would otherwise offer an edit that now fails at save.
 */
const storeOwnedAdmin = { readOnly: true, disableBulkEdit: true } as const

/**
 * Merch — a local mirror of the storefront catalogue, written by the
 * `syncShopifyProducts` job rather than by hand.
 *
 * Two things here aren't obvious from the fields:
 *
 * The `collections` field holds *storefront* collection handles — the store's
 * own product groupings — and has nothing to do with Payload collections like
 * this one. It keeps the vendor's word so a row reads against the Storefront
 * response without translating, and because Shopify uses "category" for a
 * different concept we may yet want that name for.
 *
 * Products are never hard-deleted. One the store stops listing flips to
 * `archived`, so a Merch block pointing at it degrades to "not shown" rather
 * than a dangling reference.
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
    // Order is presentation, not a constraint: both cells reach the document,
    // the thumbnail through the `link` prop Payload gives the leading column
    // and the title regardless of where it sits.
    defaultColumns: ["imageUrl", "title", "price", "availableForSale", "status", "lastSyncedAt"],
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
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
        components: {
          // Payload links one cell per row and picks it by column order. The
          // title is what an editor reads and reaches for, so it opens the
          // product from wherever it happens to sit.
          Cell: "@/collections/Merch/components/ProductTitleCell#ProductTitleCell",
        },
      },
    },
    {
      name: "externalId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
        description: "The store's own product ID — the key each sync upserts on.",
      },
    },
    {
      name: "source",
      type: "select",
      defaultValue: "shopify",
      index: true,
      options: [{ label: "Shopify", value: "shopify" }],
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
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
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
        description:
          "Shopify's URL handle. The link we render is derived from this, so a rename in Shopify is picked up by the next sync.",
      },
    },
    {
      name: "description",
      type: "textarea",
      access: { update: storeOwned },
      admin: storeOwnedAdmin,
    },
    {
      type: "row",
      fields: [
        {
          name: "price",
          type: "text",
          access: { update: storeOwned },
          admin: {
            ...storeOwnedAdmin,
            width: "33%",
            description: "Minimum variant price, as a decimal string.",
          },
        },
        {
          name: "compareAtPrice",
          type: "text",
          access: { update: storeOwned },
          admin: { ...storeOwnedAdmin, width: "33%" },
        },
        {
          name: "currencyCode",
          type: "text",
          access: { update: storeOwned },
          admin: { ...storeOwnedAdmin, width: "33%" },
        },
      ],
    },
    {
      name: "availableForSale",
      type: "checkbox",
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
        description: 'As Shopify reports it. The block turns this into the "Sold Out" badge.',
      },
    },
    {
      name: "imageUrl",
      type: "text",
      label: "Image",
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
        description: "Shopify CDN URL. Rendered directly — we don't copy product shots locally.",
        components: {
          // Without this the list column would be a long CDN URL; the product
          // shot is what makes a row recognisable at a glance.
          Cell: "@/collections/Merch/components/ProductThumbnailCell#ProductThumbnailCell",
        },
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "imageWidth",
          type: "number",
          access: { update: storeOwned },
          admin: { ...storeOwnedAdmin, width: "33%" },
        },
        {
          name: "imageHeight",
          type: "number",
          access: { update: storeOwned },
          admin: { ...storeOwnedAdmin, width: "33%" },
        },
        {
          name: "imageAlt",
          type: "text",
          access: { update: storeOwned },
          admin: { ...storeOwnedAdmin, width: "33%" },
        },
      ],
    },
    {
      name: "tags",
      type: "text",
      hasMany: true,
      index: true,
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
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
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
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
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
        description:
          "Archived means Shopify stopped listing it. Archived products are never shown.",
      },
    },
    {
      name: "lastSyncedAt",
      type: "date",
      access: { update: storeOwned },
      admin: {
        ...storeOwnedAdmin,
        date: { pickerAppearance: "dayAndTime" },
        description:
          "When the last sync last saw this product. A stale date means the job stopped running.",
      },
    },
    {
      type: "collapsible",
      label: "Presentation",
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
