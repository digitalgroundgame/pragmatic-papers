import {
  fetchYouTubeOEmbed,
  sanitizeYouTubeHtml,
  YOUTUBE_DISPLAY_NAME,
} from "@/blocks/SocialEmbed/adapters/youtube.adapter"
import { EmbedError } from "@/blocks/SocialEmbed/embeds/EmbedError"
import type { SocialEmbedBlock } from "@/payload-types"
import { isFailure } from "@/utilities/results"

export async function YouTubeEmbedBlock(props: SocialEmbedBlock): Promise<React.ReactNode> {
  const { url, snapshot } = props

  if (snapshot?.status && snapshot.status !== "ok") {
    return (
      <EmbedError
        url={url}
        message="This video is unavailable."
        displayName={YOUTUBE_DISPLAY_NAME}
      />
    )
  }

  let html = snapshot?.html

  // Legacy behavior for backwards compatibility with blocks containing no snapshot
  if (!html) {
    const result = await fetchYouTubeOEmbed({ url })
    if (isFailure(result)) {
      return (
        <EmbedError url={url} message={result.error.message} displayName={YOUTUBE_DISPLAY_NAME} />
      )
    }
    html = await sanitizeYouTubeHtml(result.value.html)
  }

  return (
    <div className="my-8 flex justify-center">
      <div className="w-full max-w-[640px]">
        <div className="relative aspect-video">
          <div
            className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  )
}
