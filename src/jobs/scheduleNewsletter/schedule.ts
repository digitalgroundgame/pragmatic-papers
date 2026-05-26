/**
 * Pure helpers for computing 7am-ET weekday send times.
 *
 * The newsletter sends one campaign per weekday at 7:00 America/New_York,
 * which observes DST. Implemented without a TZ library by probing
 * Intl.DateTimeFormat for the NY offset on the target calendar date.
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
 * Returns the UTC instant of 7:00 America/New_York on the given NY calendar
 * date. DST-correct: probes the NY offset on the same day and adjusts.
 */
export function sevenAmEtAsUtc(year: number, month: number, day: number): Date {
  const probe = new Date(Date.UTC(year, month, day, 12))
  const hour = nyHour(probe)
  // If 12:00 UTC shows as hour H in NY, then NY is (12 - H) hours ahead of UTC.
  // For NY this is always negative (NY is behind UTC). 7am NY in UTC = 7 - (H - 12) = 19 - H.
  return new Date(Date.UTC(year, month, day, 19 - hour))
}

/**
 * Returns the UTC instant of 7am ET on the next NY weekday strictly after the
 * given Date's NY calendar date. Weekends (Sat/Sun) are skipped.
 */
export function nextWeekday7amET(after: Date): Date {
  const p = nyParts(after)
  let cursor = new Date(Date.UTC(p.year, p.month, p.day + 1, 12))
  // Loop has a finite upper bound (≤3 iterations: at most 3 days of weekend).
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
 * Human-readable campaign name shown in Listmonk's admin UI. Purely
 * cosmetic — idempotency is driven by tags, not by parsing this string.
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
 * Tag identifying any newsletter campaign created by this job. Lets us
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

const ARTICLE_TAG_RE = /^art-(\d+)$/

/**
 * Extract an article ID from a single tag string if it matches `art-<id>`.
 * Returns null for any other tag.
 */
export function parseArticleIdFromTag(tag: string): number | null {
  const m = tag.match(ARTICLE_TAG_RE)
  if (!m?.[1]) return null
  const id = Number(m[1])
  return Number.isFinite(id) ? id : null
}
