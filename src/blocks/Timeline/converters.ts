import type { TimelineBlock } from "@/payload-types"
import { escapeHTML, type FeedContext } from "@/utilities/feedHTML"
import { absoluteURL } from "@/utilities/getURL"
import { linkHref } from "@/utilities/linkField"
import { formatLongDate } from "@/utilities/formatDate"

type TimelineEvent = TimelineBlock["events"][number]

/**
 * An event's date as readers see it, e.g. "November 4, 2021". Formatted in
 * UTC, where the CMS stores dates at noon, so the day doesn't shift with the
 * server's or reader's time zone. A value that isn't an ISO date is shown as
 * is (`Date` alone would read "<2024>" as January 1).
 */
export const formatTimelineDate = (date: string): string => {
  const parsed = new Date(date)
  if (!/^\d{4}-\d{2}-\d{2}/.test(date) || Number.isNaN(parsed.getTime())) return date
  return formatLongDate(parsed)
}

/** What a rendering of a timeline event shows: the date formatted, and the citation as a URL. */
export interface TimelineEventDisplay {
  date: string
  title: string | null
  description: string
  /** A site path or absolute URL, or null when the event cites nothing. */
  citationUrl: string | null
}

export const timelineEventDisplay = (event: TimelineEvent): TimelineEventDisplay => ({
  date: formatTimelineDate(event.date),
  title: event.title || null,
  description: event.description ?? "",
  citationUrl: event.enableCitation ? linkHref(event.citation) : null,
})

/** A timeline as a heading and a list of dated events, each linking to its source. */
export const timelineToHTML = (
  { title, events }: Pick<TimelineBlock, "title" | "events">,
  { siteUrl }: Pick<FeedContext, "siteUrl">,
): string => {
  if (!events?.length) return ""

  const items = events
    .map(timelineEventDisplay)
    .map((event) =>
      [
        `<li><strong>${escapeHTML(event.date)}</strong>`,
        event.title ? ` — <strong>${escapeHTML(event.title)}</strong>` : "",
        `<br />${escapeHTML(event.description)}`,
        event.citationUrl
          ? ` <a href="${escapeHTML(absoluteURL(event.citationUrl, siteUrl))}">[source]</a>`
          : "",
        "</li>",
      ].join(""),
    )
    .join("")

  return `${title ? `<h3>${escapeHTML(title)}</h3>` : ""}<ul>${items}</ul>`
}
