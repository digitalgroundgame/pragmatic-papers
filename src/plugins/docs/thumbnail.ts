import type { Doc } from "@/payload-types"
import type { NotificationItem } from "@/plugins/notifications"
import { getMediaUrl } from "@/utilities/getMediaUrl"

/**
 * The hero image's 300px-wide thumbnail size, or the image itself where it has none (an SVG).
 * Its own module so the /docs index can use it without `notifications.ts`, whose import of the
 * queries would bring the Payload config into Storybook's browser bundle.
 */
export const docThumbnail = (
  heroImage: Doc["heroImage"] | null | undefined,
): NotificationItem["image"] => {
  if (!heroImage || typeof heroImage !== "object") return undefined
  const url = getMediaUrl(heroImage.sizes?.thumbnail?.url || heroImage.url)
  return url ? { url, alt: heroImage.alt ?? "" } : undefined
}
