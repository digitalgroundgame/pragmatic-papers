import { hasRoleOrAdmin, isStaff, type Role } from "@/access/roles"
import type { NotificationSource } from "@/plugins/notifications"

import { docThumbnail } from "./thumbnail"

/**
 * Help docs for the notifications bell, for staff only: every published doc whose audience
 * includes one of the user's roles (or that has none), newest first, dated by its
 * `publishedAt`. The list is the cached one /docs reads.
 */
export const docsNotifications = (): NotificationSource => ({
  type: {
    slug: "docs",
    label: "Docs",
    description: "New features in the admin, and how to use them.",
  },
  index: { label: "All docs", href: "/docs" },
  itemsFor: async ({ user }) => {
    if (!isStaff(user)) return []
    // Imported here: the queries reach the Payload config, which imports this file.
    const { queryPublishedDocs } = await import("./queries")
    const docs = await queryPublishedDocs()
    return docs
      .filter((doc) => !doc.audience?.length || hasRoleOrAdmin(user, doc.audience as Role[]))
      .map((doc) => ({
        id: doc.slug ?? String(doc.id),
        title: doc.title,
        summary: doc.summary,
        href: `/docs/${doc.slug}`,
        date: doc.publishedAt,
        image: docThumbnail(doc.heroImage),
      }))
  },
})
