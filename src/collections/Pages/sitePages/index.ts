import type { Access, Field, RowField, Where } from "payload"

import { isAdmin } from "@/access/roles"

/**
 * Pages a route of the site's own reads: the route at `/<slug>` lists something only code can
 * (every topic, search results) and takes its title, introduction and aside from this page,
 * the way `/` reads the `home` page. Each is a starter page (`STARTER_PAGES`) a deploy creates
 * once as a draft, carrying its key. The key is what the route looks the page up by, so its
 * slug is fixed (it's the route's path) and it can't be deleted.
 */
export const SITE_PAGES = [{ label: "Topics (/topics)", value: "topics" }] as const

export type SitePageKey = (typeof SITE_PAGES)[number]["value"]

/** The read-only key a site page carries, in the sidebar, shown only on those pages. */
export const sitePageKeyField: Field = {
  name: "key",
  label: "Site page",
  type: "select",
  options: [...SITE_PAGES],
  unique: true,
  // Only a deploy sets it (overrideAccess), when it creates the starter page.
  access: { create: () => false, update: () => false },
  admin: {
    position: "sidebar",
    readOnly: true,
    condition: (data) => Boolean(data?.key),
    description:
      "A page of the site's own: its route lists what the site keeps (here, every topic) under this page's hero, and beside it this page's aside. Its address is fixed, and it can't be deleted.",
  },
}

/**
 * A site page's slug is its route's path, so it can't change once it carries a key: neither
 * the slug nor the box that has Payload regenerate it from the title.
 */
export function lockSitePageSlug(row: RowField): RowField {
  return {
    ...row,
    fields: row.fields.map((field) =>
      (field.type === "text" && field.name === "slug") ||
      (field.type === "checkbox" && field.name === "generateSlug")
        ? { ...field, access: { ...field.access, update: ({ doc }) => !doc?.key } }
        : field,
    ),
  }
}

/** Admins delete pages, but never a site page. */
export const deletePageAccess: Access = ({ req: { user } }): boolean | Where =>
  isAdmin(user) ? { key: { exists: false } } : false
