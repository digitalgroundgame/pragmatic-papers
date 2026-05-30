import {
  TIKTOK_DISPLAY_NAME,
  buildTikTokSrc,
  parseTikTokPostId,
} from "@/blocks/SocialEmbed/adapters/tiktok.adapter"
import type { SocialEmbedRenderProps } from "@/blocks/SocialEmbed/Component"
import { EmbedError } from "@/blocks/SocialEmbed/embeds/EmbedError"

export async function TikTokEmbedBlock({
  url,
  snapshot,
}: SocialEmbedRenderProps): Promise<React.ReactNode> {
  if (snapshot?.status && snapshot.status !== "ok") {
    if (snapshot.html) {
      return (
        <div className="my-8 flex justify-center">
          <div
            className="w-full max-w-[550px] [&>div]:my-0!"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: snapshot.html }}
          />
        </div>
      )
    }
    return (
      <EmbedError
        url={url}
        message="This post is unavailable or no longer embeddable."
        displayName={TIKTOK_DISPLAY_NAME}
      />
    )
  }

  const postId = parseTikTokPostId(url)
  if (!postId) {
    return <EmbedError url={url} message="Invalid URL" displayName={TIKTOK_DISPLAY_NAME} />
  }

  return (
    <div className="my-8 flex justify-center">
      <div className="relative w-full max-w-[360px] space-y-3">
        <div className="sr-only">
          <div className="text-sm font-medium">{TIKTOK_DISPLAY_NAME}</div>
          {snapshot?.authorName && <div className="text-sm opacity-80">{snapshot.authorName}</div>}
          {snapshot?.title && <div className="mt-2 text-sm">{snapshot.title}</div>}
          <a
            className="mt-2 inline-block text-sm underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            View on {TIKTOK_DISPLAY_NAME}
          </a>
        </div>
        <div className="relative aspect-9/16 overflow-hidden rounded-lg shadow-xl">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={buildTikTokSrc(postId, { autoplay: 1, loop: 1 })}
            title={snapshot?.title ?? "TikTok video"}
            loading="lazy"
            // allow should be explicit
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            // sandbox optional;
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </div>
      </div>
    </div>
  )
}
