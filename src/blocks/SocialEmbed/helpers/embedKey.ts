import type { SocialEmbedBlock } from "@/payload-types"

export type EmbedIdentity = Pick<SocialEmbedBlock, "platform" | "url" | "hideMedia" | "hideThread">

/**
 * Names what an embed shows: the post, and on Twitter the two display options, which change
 * the oEmbed HTML. Two articles embedding the same post share one row in `embed-snapshots`.
 */
export function embedKey({ platform, url, hideMedia, hideThread }: EmbedIdentity): string {
  const options = platform === "twitter" ? `|media:${!hideMedia}|thread:${!hideThread}` : ""
  return `${platform}|${url.trim()}${options}`
}
