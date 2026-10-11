import type { GlobalConfig } from "payload"

import { isAdmin } from "@/access/roles"

/**
 * System → Newsletter: subscriber counts, the newest signups and the latest campaigns, read from
 * Listmonk. It stores nothing; the page replaces the edit view. Admins only, since it lists
 * subscribers' emails.
 */
export const Newsletter: GlobalConfig = {
  slug: "newsletter",
  label: "Newsletter",
  access: {
    read: ({ req: { user } }) => isAdmin(user),
    update: () => false,
  },
  admin: {
    group: "System",
    hidden: ({ user }) => !isAdmin(user),
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: { Component: "@/globals/Newsletter/components/NewsletterView#NewsletterView" },
        },
      },
    },
  },
  fields: [],
}
