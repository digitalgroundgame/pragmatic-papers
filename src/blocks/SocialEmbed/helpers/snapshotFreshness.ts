import type { SocialEmbedSnapshot } from "@/payload-types"

/**
 * Whether to load the platform's script over the saved markup: only for a snapshot whose
 * fetch succeeded when the article was saved.
 */
export function shouldEnhance(snapshot: SocialEmbedSnapshot | null | undefined): boolean {
  return snapshot?.status === "ok"
}
