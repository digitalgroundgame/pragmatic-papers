import type { SocialEmbedBlock } from "@/payload-types"
import { escapeHTML } from "@/utilities/feedHTML"
import type { SerializedBlockNode } from "@payloadcms/richtext-lexical"
import { getPlatformDisplayName } from "./getPlatformDisplayName"

export function socialEmbedBlockToHTML({
  node,
}: {
  node: SerializedBlockNode<SocialEmbedBlock>
}): string {
  const { url, platform } = node.fields
  if (!url) return ""
  const displayName = platform ? getPlatformDisplayName(platform) : "Social Media"
  return `<blockquote><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">View post on ${escapeHTML(displayName)}</a></blockquote>`
}
