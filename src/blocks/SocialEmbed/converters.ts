import type { SocialEmbedBlock } from "@/payload-types"
import { escapeHTML } from "@/utilities/feedHTML"
import { getPlatformDisplayName } from "./helpers/getPlatformDisplayName"

/**
 * A link to the post instead of the embed: feeds can't run the platform's
 * script. Also renders the deprecated per-platform embed blocks.
 */
export const socialEmbedToHTML = ({
  url,
  platform,
}: Pick<SocialEmbedBlock, "url" | "platform">): string => {
  if (!url) return ""
  const displayName = platform ? getPlatformDisplayName(platform) : "Unknown"
  const label = displayName === "Unknown" ? "View the post" : `View post on ${displayName}`
  return `<blockquote><p><a href="${escapeHTML(url)}">${escapeHTML(label)}</a></p></blockquote>`
}
