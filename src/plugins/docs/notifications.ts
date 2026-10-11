import type { Payload } from "payload"
import { hasRoleOrAdmin, isStaff, type Role } from "@/access/roles"
import type { NotificationSource } from "@/plugins/notifications"
import { findTour, tourHref } from "@/plugins/tours"

import { HOME_DOC_SLUG, WHATS_NEW_PATH } from "./sections"
import { docThumbnail } from "./thumbnail"

type Switch = (payload: Payload) => boolean | Promise<boolean>

export interface DocsNotificationsOptions {
  /** Whether help docs are offered at all (e.g. a beta switch). Always, when unset. */
  enabled?: Switch
  /** Whether a doc's tour is offered as Show me. Always, when unset. */
  tours?: Switch
}

/**
 * Help docs for the notifications bell, for staff only: every published doc whose audience
 * includes one of the user's roles (or that has none), newest first, dated by its
 * `publishedAt`, leaving out the docs' home page. The list is the cached one What's new reads. A
 * doc with a tour offers it as Show me, while `tours` allows.
 */
export const docsNotifications = ({
  enabled,
  tours,
}: DocsNotificationsOptions = {}): NotificationSource => ({
  type: {
    slug: "docs",
    label: "Docs",
    description: "New features in the admin, and how to use them.",
  },
  index: { label: "See all", href: WHATS_NEW_PATH },
  itemsFor: async ({ payload, user }) => {
    if (!isStaff(user)) return []
    if (enabled && !(await enabled(payload))) return []
    const showTours = !tours || (await tours(payload))
    // Imported here: the queries reach the Payload config, which imports this file.
    const { queryPublishedDocs } = await import("./queries")
    const docs = await queryPublishedDocs()
    return docs
      .filter((doc) => doc.slug !== HOME_DOC_SLUG)
      .filter((doc) => !doc.audience?.length || hasRoleOrAdmin(user, doc.audience as Role[]))
      .map((doc) => ({
        id: doc.slug ?? String(doc.id),
        title: doc.title,
        summary: doc.summary,
        href: `/docs/${doc.slug}`,
        date: doc.publishedAt,
        image: docThumbnail(doc.heroImage),
        ...(showTours && findTour(doc.tour) ? { showMe: tourHref(doc.tour!) } : {}),
      }))
  },
})
