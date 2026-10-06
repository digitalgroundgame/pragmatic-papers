import { mediaToFigure } from "@/blocks/MediaBlock/converters"
import type { MediaCollageBlock } from "@/payload-types"
import type { FeedContext } from "@/utilities/feedHTML"

/**
 * A collage as one figure per image, in order. The grid or carousel is the
 * web page's layout; feeds lay figures out themselves.
 */
export const mediaCollageToHTML = (
  { images }: Pick<MediaCollageBlock, "images">,
  context: Pick<FeedContext, "siteUrl" | "richTextToHTML">,
): string => (images ?? []).map(({ media }) => mediaToFigure(media, context)).join("")
