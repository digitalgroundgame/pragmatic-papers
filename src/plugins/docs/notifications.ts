import { hasRoleOrAdmin, isStaff, type Role } from "@/access/roles"
import type { Doc } from "@/payload-types"
import type { NotificationItem, NotificationSource } from "@/plugins/notifications"
import { getMediaUrl } from "@/utilities/getMediaUrl"

/** The hero image's 300px-wide thumbnail size, or the image itself where it has none (an SVG). */
export const docThumbnail = (
  heroImage: Doc["heroImage"] | null | undefined,
): NotificationItem["image"] => {
  if (!heroImage || typeof heroImage !== "object") return undefined
  const url = getMediaUrl(heroImage.sizes?.thumbnail?.url || heroImage.url)
  return url ? { url, alt: heroImage.alt ?? "" } : undefined
}

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
