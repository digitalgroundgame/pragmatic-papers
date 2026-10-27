import type { Payload } from "payload"
import { hasRoleOrAdmin, isEditor, isStaff, type Role } from "@/access/roles"
import type { NotificationSource } from "@/plugins/notifications"
import { findTour, tourHref } from "@/plugins/tours"

import { docPaths, docsTree, HOME_DOC_SLUG, parentIds, WHATS_NEW_PATH } from "./sections"
import { DOC_SUGGESTIONS_SLUG } from "./suggestionsCollection"
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
 * `publishedAt`, leaving out the docs' home page and the areas and sections other docs sit
 * under, which introduce docs rather than announce a feature. The list is the cached one What's
 * new reads. A doc with a tour offers it as Show me, while `tours` allows.
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
  enabled,
  itemsFor: async ({ payload, user }) => {
    if (!isStaff(user)) return []
    const showTours = !tours || (await tours(payload))
    // Imported here: the queries reach the Payload config, which imports this file.
    const { queryPublishedDocs } = await import("./queries")
    const docs = await queryPublishedDocs()
    const tree = docsTree(docs)
    const paths = docPaths(tree)
    const parents = parentIds(tree)
    return docs
      .filter((doc) => doc.slug !== HOME_DOC_SLUG && !parents.has(String(doc.id)))
      .filter((doc) => !doc.audience?.length || hasRoleOrAdmin(user, doc.audience as Role[]))
      .map((doc) => ({
        id: doc.slug ?? String(doc.id),
        title: doc.title,
        summary: doc.summary,
        href: paths.get(doc.slug ?? "") ?? `/docs/${doc.slug}`,
        date: doc.publishedAt,
        image: docThumbnail(doc.heroImage),
        ...(showTours && findTour(doc.tour) ? { showMe: tourHref(doc.tour!) } : {}),
      }))
  },
})

/**
 * The repo's changes to docs this site has, for the notifications bell, for editors only (the
 * staff who own the docs): each open suggestion, newest first, linking to it in the admin. Each
 * time a deploy adds to an open suggestion it's dated afresh, so it counts as unread again.
 */
export const docSuggestionsNotifications = (): NotificationSource => ({
  type: {
    slug: "doc-suggestions",
    label: "Doc suggestions",
    description: "Changes to features that the help docs should mention.",
  },
  index: { label: "See all", href: `/admin/collections/${DOC_SUGGESTIONS_SLUG}` },
  itemsFor: async ({ payload, user }) => {
    if (!isEditor(user)) return []
    const { docs } = await payload.find({
      collection: DOC_SUGGESTIONS_SLUG,
      depth: 0,
      limit: 20,
      overrideAccess: true,
      pagination: false,
      select: { title: true, note: true, updatedAt: true },
      sort: "-updatedAt",
      where: { status: { equals: "open" } },
    })
    return docs.map((suggestion) => ({
      id: `${suggestion.id}:${suggestion.updatedAt}`,
      title: `Update the doc: ${suggestion.title}`,
      summary: suggestion.note ?? undefined,
      href: `/admin/collections/${DOC_SUGGESTIONS_SLUG}/${suggestion.id}`,
      date: suggestion.updatedAt,
    }))
  },
})
