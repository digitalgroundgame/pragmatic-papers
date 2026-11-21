import { getAdapter } from "@/blocks/SocialEmbed/adapters"
import { buildSnapshot } from "@/blocks/SocialEmbed/helpers/buildSnapshot"
import type { Article, SocialEmbedBlock } from "@/payload-types"
import { isAutosave } from "@/utilities/isAutosave"
import type { FieldHookArgs } from "payload"

export async function fetchSnapshot({
  req,
  siblingData,
  value = "",
}: FieldHookArgs<Article, string, SocialEmbedBlock>): Promise<string> {
  // Nothing is fetched on an autosave, or when a caller asks to skip it, but the snapshot
  // sent with the save is still only a writer's word for what the platform returned.
  if (isAutosave(req) || req?.context?.skipSocialEmbedSnapshot) {
    const html = siblingData.snapshot?.html
    if (html) {
      const adapter = siblingData.platform ? getAdapter(siblingData.platform) : null
      siblingData.snapshot = {
        ...siblingData.snapshot,
        html: adapter ? await adapter.sanitize(html) : undefined,
      }
    }
    return value
  }

  if (!siblingData.platform) {
    siblingData.snapshot = {
      ...siblingData.snapshot,
      html: undefined,
      status: "not_found",
      title: "No platform found",
      fetchedAt: new Date().toISOString(),
    }
    return value
  }

  siblingData.snapshot = await buildSnapshot({
    platform: siblingData.platform,
    url: value,
    snapshot: siblingData.snapshot,
    hideMedia: siblingData.hideMedia,
    hideThread: siblingData.hideThread,
  })

  return value
}
