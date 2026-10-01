import type { InteractiveMapBlock } from "@/payload-types"
import { escapeHTML, type FeedContext } from "@/utilities/feedHTML"

const SITE_NAME = "The Pragmatic Papers"

/**
 * A link back to the page the map sits on: the map needs the site's script to
 * draw and its tooltips to read, which no feed reader runs.
 */
export const interactiveMapToHTML = (
  { widgetTitle }: Pick<InteractiveMapBlock, "widgetTitle">,
  { pageUrl }: Pick<FeedContext, "pageUrl">,
): string => {
  const title = widgetTitle ? `“${escapeHTML(widgetTitle)}” ` : ""
  return `<p><a href="${escapeHTML(pageUrl)}">View the interactive map ${title}on ${SITE_NAME} →</a></p>`
}
