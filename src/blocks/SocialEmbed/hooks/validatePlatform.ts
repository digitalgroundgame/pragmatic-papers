import { detectPlatform } from "@/blocks/SocialEmbed/helpers/detectPlatform"
import type { Article, SocialEmbedBlock } from "@/payload-types"
import type { SelectField, ValidateOptions } from "payload"

export function validatePlatform(
  value: string | null | undefined,
  { siblingData }: ValidateOptions<Article, SocialEmbedBlock, SelectField, string>,
): true | string {
  const detected = detectPlatform(siblingData.url || "")
  if (!detected) return "Invalid platform."
  // only rejects validation of the platform value is provided and does not match the detected platform
  return !value || detected === value ? true : "Platform does not match URL."
}
