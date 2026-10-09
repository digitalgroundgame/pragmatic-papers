import { hasRoleOrAdmin, isStaff, type Role } from "@/access/roles"
import type { NotificationSource } from "@/plugins/notifications"

import { announcements, type BacklogOptions } from "./schedule"

/** The release that ships the bell. Docs about features older than it trickle in weekly. */
const BACKLOG: BacklogOptions = { launch: "2026-10-18", perWeek: 3 }

/**
 * Help docs for the notifications bell, for staff only: every published doc whose audience
 * includes one of the user's roles (or that has none), once the bell announces it (see
 * `announcements`). The list is the cached one /docs reads.
 */
export const docsNotifications = (
  backlog: BacklogOptions = BACKLOG,
  now: () => number = Date.now,
): NotificationSource => ({
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
    return (
      // Scheduled across every doc, so each audience gets the same weeks.
      announcements(docs, backlog, now())
        .filter(({ doc }) => !doc.audience?.length || hasRoleOrAdmin(user, doc.audience as Role[]))
        // Newest announcement first; within a weekly batch, newest feature first.
        .sort(
          (a, b) =>
            Date.parse(b.announceAt) - Date.parse(a.announceAt) ||
            Date.parse(b.doc.publishedAt) - Date.parse(a.doc.publishedAt),
        )
        // Dated by the announcement, so a backlog doc counts as new the week it arrives.
        .map(({ doc, announceAt }) => ({
          id: doc.slug ?? String(doc.id),
          title: doc.title,
          summary: doc.summary,
          href: `/docs/${doc.slug}`,
          date: announceAt,
        }))
    )
  },
})
