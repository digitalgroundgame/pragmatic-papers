import type { SocialEmbedBlock } from "@/payload-types"
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
  return `<blockquote><a href="${url}" target="_blank" rel="noopener noreferrer">View post on ${displayName}</a></blockquote>`
}
