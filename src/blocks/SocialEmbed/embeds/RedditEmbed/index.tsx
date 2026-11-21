import {
  REDDIT_DISPLAY_NAME,
  fetchRedditOEmbed,
  sanitizeRedditHtml,
} from "@/blocks/SocialEmbed/adapters/reddit.adapter"
import { EmbedError } from "@/blocks/SocialEmbed/embeds/EmbedError"
import { RedditEmbedClient } from "@/blocks/SocialEmbed/embeds/RedditEmbed/client"
import { shouldEnhance } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import type { SocialEmbedBlock } from "@/payload-types"
import { isFailure } from "@/utilities/result"

export async function RedditEmbedBlock(props: SocialEmbedBlock): Promise<React.ReactNode> {
  const { url, snapshot, id } = props

  if (!id) {
    return (
      <EmbedError url={url} message="Embed Block ID not found" displayName={REDDIT_DISPLAY_NAME} />
    )
  }

  // Sanitized again here: the snapshot is a stored field the API accepts from any writer,
  // so only what the sanitizer lets through is ever rendered as HTML.
  let html = snapshot?.html ? await sanitizeRedditHtml(snapshot.html) : null

  // Legacy behavior for backwards compatibility with blocks containing no snapshot
  if (html === null) {
    const result = await fetchRedditOEmbed({ url })
    if (isFailure(result)) {
      return (
        <EmbedError url={url} message={result.error.message} displayName={REDDIT_DISPLAY_NAME} />
      )
    }
    html = await sanitizeRedditHtml(result.value.html)
  }

  return (
    <div className="my-8 flex min-h-[240px] items-center justify-center">
      <div
        id={id}
        className="w-full max-w-[550px] [&>div]:my-0!"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {shouldEnhance(snapshot) && <RedditEmbedClient targetId={id} />}
    </div>
  )
}
