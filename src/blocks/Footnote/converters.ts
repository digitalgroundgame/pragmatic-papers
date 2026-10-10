import type { FootnoteBlock, FootnotesField } from "@/payload-types"
import { escapeHTML, type FeedContext } from "@/utilities/feedHTML"
import { absoluteURL } from "@/utilities/getURL"
import { getLinkFieldUrl } from "@/utilities/getLinkFieldUrl"

/**
 * A footnote reference as a plain `[n]` marker. No anchor: feed readers and
 * Substack drop in-page fragments, so the notes are listed after the content
 * by `footnotesToHTML` instead.
 */
export const footnoteToHTML = ({ index }: Pick<FootnoteBlock, "index">): string =>
  typeof index === "number" ? `<sup>[${index}]</sup>` : ""

/**
 * An article's notes, in index order, under a "Notes" heading: each note's
 * text, then its source link when attribution is on. Empty when there are none.
 */
export const footnotesToHTML = (
  footnotes: FootnotesField | null | undefined,
  { siteUrl }: Pick<FeedContext, "siteUrl">,
): string => {
  const items = (footnotes ?? [])
    .filter((footnote) => footnote?.note && typeof footnote.index === "number")
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(({ index, note, attributionEnabled, link }) => {
      const source = attributionEnabled ? getLinkFieldUrl(link) : null
      const href = source ? absoluteURL(source, siteUrl) : null
      const sourceHTML = href
        ? ` <a href="${escapeHTML(href)}">${escapeHTML(link?.label || href)}</a>`
        : ""
      return `<p>[${index}] ${escapeHTML(note)}${sourceHTML}</p>`
    })
    .join("")

  return items ? `<hr /><h3>Notes</h3>${items}` : ""
}
