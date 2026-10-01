import type { BannerBlock } from "@/payload-types"
import type { FeedContext } from "@/utilities/feedHTML"

/** A banner as a plain blockquote: its color is the web page's, not the content's. */
export const bannerToHTML = (
  { content }: Pick<BannerBlock, "content">,
  { richTextToHTML }: Pick<FeedContext, "richTextToHTML">,
): string => `<blockquote>${richTextToHTML(content)}</blockquote>`
