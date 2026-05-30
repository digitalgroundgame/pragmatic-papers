import { buildSnapshot } from "@/blocks/SocialEmbed/helpers/buildSnapshot"
import type { Article, SocialEmbedBlock } from "@/payload-types"
import { isAutosave } from "@/utilities/isAutosave"
import type { FieldHookArgs } from "payload"

export async function fetchSnapshot({
  req,
  siblingData,
  value = "",
}: FieldHookArgs<Article, string, SocialEmbedBlock>): Promise<string> {
  if (isAutosave(req)) return value
  if (req?.context?.skipSocialEmbedSnapshot) return value

  if (!siblingData.platform) {
    siblingData.snapshot = {
      ...siblingData.snapshot,
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
