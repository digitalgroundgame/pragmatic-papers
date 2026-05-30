import { detectPlatform } from "@/blocks/SocialEmbed/helpers/detectPlatform"
import type { Article, SocialEmbedBlock } from "@/payload-types"
import { isAutosave } from "@/utilities/isAutosave"
import type { FieldHookArgs } from "payload"

export function derivePlatform({
  req,
  value,
  siblingData,
}: FieldHookArgs<Article, string, SocialEmbedBlock>): string | undefined {
  if (isAutosave(req)) return value
  siblingData.platform = detectPlatform(siblingData.url || "") ?? undefined
  return value
}
