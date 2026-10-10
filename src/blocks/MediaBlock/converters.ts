import type { Media, MediaBlock } from "@/payload-types"
import { escapeHTML, type FeedContext } from "@/utilities/feedHTML"
import { absoluteURL } from "@/utilities/getURL"

type MediaContext = Pick<FeedContext, "siteUrl" | "richTextToHTML">

/**
 * One media document as a `<figure>`: an image with its alt text and size, or
 * for anything else (a video) a link to the file, captioned when it has one.
 * Nothing for media that wasn't loaded or has no file.
 */
export const mediaToFigure = (
  media: number | Media | null | undefined,
  { siteUrl, richTextToHTML }: MediaContext,
): string => {
  if (!media || typeof media !== "object" || !media.url) return ""

  const src = escapeHTML(absoluteURL(media.url, siteUrl))
  const alt = escapeHTML(media.alt)
  const isImage = !media.mimeType || media.mimeType.startsWith("image")
  const size = media.width && media.height ? ` width="${media.width}" height="${media.height}"` : ""
  const body = isImage
    ? `<img src="${src}" alt="${alt}"${size} />`
    : `<a href="${src}">${alt || "View the video"}</a>`
  const caption = media.caption ? richTextToHTML(media.caption) : ""

  return `<figure>${body}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`
}

export const mediaBlockToHTML = (
  { media }: Pick<MediaBlock, "media">,
  context: MediaContext,
): string => mediaToFigure(media, context)
