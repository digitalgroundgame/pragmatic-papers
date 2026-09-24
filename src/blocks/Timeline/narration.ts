import { describeVisual } from "@/utilities/describeVisual"

/**
 * Narration for the Timeline block. Unlike an image or a formula, a timeline's
 * substance is text the voice-over can actually read, so rather than collapsing
 * to a stand-in phrase it renders its events as a spoken list — one line per
 * event, in the order the author arranged them.
 *
 * The block owns this because the field shape (date/title/description per row)
 * is the block's business, not the narration extractor's. `extractNarrationText`
 * just calls `describeTimeline(fields)`.
 */

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** Add a full stop unless the author already ended the line with punctuation. */
function sentence(value: string): string {
  return /[.!?,;:]$/.test(value) ? value : `${value}.`
}

/**
 * Spoken form of an event date. Fixed to `en-US`/UTC so narration text is
 * identical wherever it is generated — the server's locale and timezone must
 * not change what an article sounds like.
 */
function spokenDate(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * One spoken line per event: "August 24, 410: Visigoths sack Rome. Alaric
 * enters the city." Citations and avatars are left out — a link has nothing to
 * say aloud, and an avatar is exactly the sort of visual this list replaces.
 */
function describeEvent(event: unknown): string {
  if (!event || typeof event !== "object") return ""
  const { date, title, description } = event as Record<string, unknown>

  const body = [text(title), text(description)].filter(Boolean).map(sentence).join(" ")
  const spoken = spokenDate(date)

  if (!spoken) return body
  return body ? `${spoken}: ${body}` : `${spoken}.`
}

export function describeTimeline(fields: Record<string, unknown>): string {
  const title = text(fields.title)

  // Items are newline-separated rather than bulleted: a literal "-" or "•" is
  // either spelled out or swallowed by a TTS engine, while a line break gives
  // the pause a bullet is there to convey. An events array that is missing or
  // entirely empty falls back to the bare "(A timeline.)" aside.
  const events = Array.isArray(fields.events)
    ? fields.events.map(describeEvent).filter(Boolean)
    : []

  return describeVisual(title ? `a timeline titled "${title}"` : "a timeline", events.join("\n"))
}
