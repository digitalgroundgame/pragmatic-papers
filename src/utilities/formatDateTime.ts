import { format, formatDistanceToNow } from "date-fns"

export const formatDateTime = (timestamp: string): string => {
  const now = new Date()
  let date = now
  if (timestamp) date = new Date(timestamp)
  // const months = date.getMonth()
  // const days = date.getDate()
  // const hours = date.getHours();
  // const minutes = date.getMinutes();
  // const seconds = date.getSeconds();

  // const MM = months + 1 < 10 ? `0${months + 1}` : months + 1
  // const DD = days < 10 ? `0${days}` : days
  // const YYYY = date.getFullYear()
  // const AMPM = hours < 12 ? 'AM' : 'PM';
  // const HH = hours > 12 ? hours - 12 : hours;
  // const MinMin = (minutes < 10) ? `0${minutes}` : minutes;
  // const SS = (seconds < 10) ? `0${seconds}` : seconds;

  return format(date, "MMMM d, yyyy")
}

/**
 * Relative phrasing — "3 hours ago" — as used on the collection tiles.
 *
 * Computed at render time, so on a statically generated page it is frozen at
 * the moment the page was built or revalidated. Pair it with an absolute date
 * (a tooltip or `title`) wherever the exact instant matters.
 */
export const formatTimeAgo = (timestamp: string): string => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
}
