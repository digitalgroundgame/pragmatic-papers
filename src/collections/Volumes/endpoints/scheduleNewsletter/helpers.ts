/**
 * Pure helpers for the newsletter scheduling logic:
 *   - 7am-ET weekday send-time math (DST-correct)
 *   - Listmonk campaign tag identifiers used for idempotency
 *
 * Kept separate from logic.ts so they're trivially testable without
 * Listmonk or Payload dependencies.
 */

function nyParts(date: Date): { year: number; month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const weekday = weekdayMap[map.weekday ?? ""]
  if (weekday === undefined) {
    throw new Error(`Could not parse NY weekday from "${map.weekday}"`)
  }
  return {
    year: Number(map.year),
    month: Number(map.month) - 1,
    day: Number(map.day),
    weekday,
  }
}

function nyHour(date: Date): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(date)
  return Number(s === "24" ? "0" : s)
}

/**
 * UTC instant of 7:00 America/New_York on the given NY calendar date.
 * DST-correct: probes the NY offset on the same day and adjusts.
 */
export function sevenAmEtAsUtc(year: number, month: number, day: number): Date {
  const probe = new Date(Date.UTC(year, month, day, 12))
  const hour = nyHour(probe)
  // If 12:00 UTC shows as hour H in NY, NY is (12 - H) hours behind UTC.
  // 7am NY in UTC = 7 - (H - 12) = 19 - H.
  return new Date(Date.UTC(year, month, day, 19 - hour))
}

/**
 * UTC instant of 7am ET on the next NY weekday strictly after the given Date's
 * NY calendar date. Weekends (Sat/Sun) are skipped.
 */
export function nextWeekday7amET(after: Date): Date {
  const p = nyParts(after)
  let cursor = new Date(Date.UTC(p.year, p.month, p.day + 1, 12))
  for (let i = 0; i < 7; i++) {
    const cp = nyParts(cursor)
    if (cp.weekday >= 1 && cp.weekday <= 5) {
      return sevenAmEtAsUtc(cp.year, cp.month, cp.day)
    }
    cursor = new Date(Date.UTC(cp.year, cp.month, cp.day + 1, 12))
  }
  throw new Error("nextWeekday7amET could not find a weekday within 7 iterations")
}

/**
 * Human-readable campaign name shown in Listmonk's admin UI. Purely cosmetic
 * — idempotency is driven by tags, not by parsing this string.
 * Format: "Volume <N> · Day <K> of <Total> · <title>"
 */
export function campaignName(
  volumeNumber: number,
  dayIndex: number,
  totalDays: number,
  articleTitle: string,
): string {
  return `Volume ${volumeNumber} · Day ${dayIndex + 1} of ${totalDays} · ${articleTitle}`
}

/**
 * Tag identifying any campaign created by this scheduler. Lets us
 * distinguish "campaigns we made" from any other scheduled work in
 * Listmonk that happens to be on the same list.
 */
export const NEWSLETTER_TAG = "newsletter"

/** Tag for a specific Volume — combined with NEWSLETTER_TAG, narrows to one Volume. */
export function volumeTag(volumeNumber: number): string {
  return `vol-${volumeNumber}`
}

/** Tag carrying the article identity — the actual idempotency key. */
export function articleTag(articleId: number): string {
  return `art-${articleId}`
}

/**
 * Tag carrying the 1-based day number within the Volume drip. The mid-drip
 * welcome flow reads this (not the campaign name) to work out which articles
 * have already been sent, so the human-readable name stays purely cosmetic.
 */
export function dayTag(dayNumber: number): string {
  return `day-${dayNumber}`
}

const ARTICLE_TAG_RE = /^art-(\d+)$/
const VOLUME_TAG_RE = /^vol-(\d+)$/
const DAY_TAG_RE = /^day-(\d+)$/

function parseTaggedNumber(tag: string, re: RegExp): number | null {
  const m = tag.match(re)
  if (!m?.[1]) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Extract an article ID from a single tag string if it matches `art-<id>`.
 * Returns null for any other tag.
 */
export function parseArticleIdFromTag(tag: string): number | null {
  return parseTaggedNumber(tag, ARTICLE_TAG_RE)
}

/** Extract the Volume number from a `vol-<n>` tag, or null. */
export function parseVolumeFromTag(tag: string): number | null {
  return parseTaggedNumber(tag, VOLUME_TAG_RE)
}

/** Extract the 1-based day number from a `day-<n>` tag, or null. */
export function parseDayFromTag(tag: string): number | null {
  return parseTaggedNumber(tag, DAY_TAG_RE)
}
