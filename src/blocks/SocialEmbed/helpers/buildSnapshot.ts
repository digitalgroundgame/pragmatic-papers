import { getAdapter } from "@/blocks/SocialEmbed/adapters"
import { OEmbedRequestError } from "@/blocks/SocialEmbed/helpers/fetchOEmbed"
import { isOEmbedRich, isOEmbedThumbnail } from "@/blocks/SocialEmbed/helpers/oEmbed"
import type { SocialEmbedBlock, SocialEmbedSnapshot } from "@/payload-types"
import { isFailure } from "@/utilities/results"

export type BuildSnapshotArgs = Pick<
  SocialEmbedBlock,
  "platform" | "url" | "snapshot" | "hideMedia" | "hideThread"
>

/**
 * Shared implementation used by both:
 * - Payload admin save hooks (initial snapshot)
 * - Runtime stale revalidation (snapshot refresh)
 */
export async function buildSnapshot({
  platform,
  url,
  snapshot = {},
  hideMedia,
  hideThread,
}: BuildSnapshotArgs): Promise<SocialEmbedSnapshot> {
  const adapter = getAdapter(platform)
  if (!adapter) {
    return {
      ...snapshot,
      status: "not_found",
      title: snapshot?.title ?? "No adapter found",
      fetchedAt: new Date().toISOString(),
    }
  }

  const result = await adapter.getOEmbed({
    url,
    ...(platform === "twitter" && {
      hideMedia,
      hideThread,
    }),
  })

  if (isFailure(result)) {
    return {
      ...snapshot,
      status: result.error instanceof OEmbedRequestError ? result.error.code : "error",
      fetchedAt: new Date().toISOString(),
    }
  }

  const {
    provider_name: providerName,
    provider_url: providerURL,
    author_name: authorName,
    author_url: authorURL,
    title,
    ...rest
  } = result.value

  let html: string | undefined
  if (isOEmbedRich(result.value)) {
    html = await adapter.sanitize(result.value.html)
  }

  let thumbnailURL: string | undefined
  if (isOEmbedThumbnail(rest)) {
    thumbnailURL = rest.thumbnail_url
  }

  return {
    ...snapshot,
    status: "ok",
    providerName,
    providerURL,
    authorName,
    authorURL,
    title,
    html,
    thumbnailURL,
    fetchedAt: new Date().toISOString(),
  }
}
