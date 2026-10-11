const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * Relative phrasing — "3 hours ago", "yesterday" — as used on the collection tiles.
 *
 * Each unit takes over a little before the next whole one, so 50 minutes reads
 * "1 hour ago" rather than "50 minutes ago".
 *
 * Computed at render time, so on a statically generated page it is frozen at
 * the moment the page was built or revalidated. Pair it with an absolute date
 * (a tooltip or `title`) wherever the exact instant matters.
 */
export const formatTimeAgo = (timestamp: string): string => {
  const seconds = (new Date(timestamp).getTime() - Date.now()) / 1000
  const distance = Math.abs(seconds)

  if (distance < 45) return "just now"
  if (distance < 45 * MINUTE) return relativeTime.format(Math.round(seconds / MINUTE), "minute")
  if (distance < 22 * HOUR) return relativeTime.format(Math.round(seconds / HOUR), "hour")
  if (distance < 26 * DAY) return relativeTime.format(Math.round(seconds / DAY), "day")
  if (distance < 320 * DAY) return relativeTime.format(Math.round(seconds / MONTH), "month")
  return relativeTime.format(Math.round(seconds / YEAR), "year")
}

export function TimeAgo({ publishedAt }: { publishedAt?: string | null }): React.ReactNode {
  if (!publishedAt) return null
  return (
    <p data-slot="time-ago" className="text-muted-foreground mt-1 font-sans text-xs">
      {formatTimeAgo(publishedAt)}
    </p>
  )
}
