import {
  TWITTER_DISPLAY_NAME,
  fetchTwitterOEmbed,
  sanitizeTwitterHtml,
} from "@/blocks/SocialEmbed/adapters/twitter.adapter"
import { EmbedError } from "@/blocks/SocialEmbed/embeds/EmbedError"
import { TwitterEmbedClient } from "@/blocks/SocialEmbed/embeds/TwitterEmbed/client"
import { shouldEnhance } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import type { SocialEmbedBlock } from "@/payload-types"
import { isFailure } from "@/utilities/result"

export async function TwitterEmbedBlock(props: SocialEmbedBlock): Promise<React.ReactNode> {
  const { url, snapshot, id, hideMedia, hideThread } = props

  if (!id) {
    return (
      <EmbedError url={url} message="Embed Block ID not found" displayName={TWITTER_DISPLAY_NAME} />
    )
  }

  // Sanitized again here: the snapshot is a stored field the API accepts from any writer,
  // so only what the sanitizer lets through is ever rendered as HTML.
  let html = snapshot?.html ? await sanitizeTwitterHtml(snapshot.html) : null

  // Legacy behavior for backwards compatibility with blocks containing no snapshot
  if (html === null) {
    const result = await fetchTwitterOEmbed({ url, hideMedia, hideThread })
    if (isFailure(result)) {
      return (
        <EmbedError url={url} message={result.error.message} displayName={TWITTER_DISPLAY_NAME} />
      )
    }
    html = await sanitizeTwitterHtml(result.value.html)
  }

  return (
    <div className="my-8 flex min-h-[240px] items-center justify-center">
      <div
        id={id}
        className="w-full max-w-[550px] [&>div]:my-0!"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {shouldEnhance(snapshot) && <TwitterEmbedClient targetId={id} />}
    </div>
  )
}
