import type { Field } from "payload"

/**
 * What an embed's oEmbed fetch returned. The block keeps the copy fetched when the article was
 * saved; `embed-snapshots` keeps the copy the daily refresh fetched since, and the page shows
 * whichever is newer.
 */
export const snapshotFields: Field[] = [
  {
    name: "status",
    type: "select",
    options: [
      "ok",
      "not_found",
      "forbidden",
      "error",
      "timeout",
      "aborted",
      "invalid_oembed_response",
    ],
  },
  { name: "fetchedAt", type: "date", label: "Fetched At" },
  { name: "providerName", type: "text", label: "Provider Name" },
  { name: "providerURL", type: "text", label: "Provider URL" },
  { name: "authorName", type: "text", label: "Author Name" },
  { name: "authorURL", type: "text", label: "Author URL" },
  { name: "title", type: "text", label: "Title" },
  { name: "html", type: "text", label: "HTML" },
  { name: "thumbnailURL", type: "text", label: "Thumbnail URL" },
]
