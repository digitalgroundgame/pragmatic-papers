const WEEK = 7 * 24 * 60 * 60 * 1000

export interface BacklogOptions {
  /** The day the bell first announces docs. A doc dated earlier is backlog. */
  launch: string
  /** How many backlog docs the bell announces each week. */
  perWeek: number
}

interface Dated {
  slug?: string | null
  publishedAt: string
}

export interface Announcement<T> {
  doc: T
  /** When the bell announces it, and the date it shows under. */
  announceAt: string
}

const bySlug = (a?: string | null, b?: string | null): number => (a ?? "").localeCompare(b ?? "")

/**
 * The docs the bell announces by `now`, and when. A doc dated from `launch` on is announced
 * straight away, under its own date. Docs written later about features that shipped before
 * then (the backlog) are released `perWeek` at a time, one batch a week from `launch`, newest
 * feature first, so catching up on them never floods the bell. Doc pages and /docs show every
 * doc either way.
 */
export function announcements<T extends Dated>(
  docs: T[],
  { launch, perWeek }: BacklogOptions,
  now: number,
): Announcement<T>[] {
  const start = Date.parse(launch)
  const backlog = docs
    .filter((doc) => Date.parse(doc.publishedAt) < start)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || bySlug(a.slug, b.slug))
  const releasedAt = new Map(backlog.map((doc, i) => [doc, start + Math.floor(i / perWeek) * WEEK]))

  return docs.flatMap((doc) => {
    const at = releasedAt.get(doc)
    if (at === undefined) return [{ doc, announceAt: doc.publishedAt }]
    return at <= now ? [{ doc, announceAt: new Date(at).toISOString() }] : []
  })
}
