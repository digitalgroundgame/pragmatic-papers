/**
 * Newspaper-style datelines: the day the piece ran, plus the time of the latest
 * revision when there is one — "Aug. 20, 2026 Updated 6:56 p.m. ET".
 *
 * Everything is rendered in the paper's own timezone rather than the server's
 * or the reader's, so a stamp means the same thing to everyone reading it. The
 * `<time datetime>` attribute carries the real instant for anything that needs
 * to compute with it.
 */

/**
 * Editorial configuration that currently lives in code. It belongs in a site
 * Settings global next to Header and Footer; when one exists, the formatters
 * below take the zone as an argument instead of reading it from here.
 *
 * Tracked in #934, which grew out of the settings-panel discussion in #912.
 */
export const PUBLICATION_TIME_ZONE = "America/New_York"

/** AP style abbreviates only the months too long to spell out, each with a period. */
const AP_MONTHS = [
  "Jan.",
  "Feb.",
  "March",
  "April",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
] as const

type DatePart = Intl.DateTimeFormatPartTypes

function zonedParts(
  timestamp: string,
  options: Intl.DateTimeFormatOptions,
): Partial<Record<DatePart, string>> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PUBLICATION_TIME_ZONE,
    ...options,
  }).formatToParts(new Date(timestamp))

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
}

/** "Aug. 20, 2026" */
export function formatPublishedDate(timestamp: string): string {
  const { month, day, year } = zonedParts(timestamp, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })

  return `${AP_MONTHS[Number(month) - 1]} ${day}, ${year}`
}

/** "6:56 p.m. ET" */
export function formatTimeOfDay(timestamp: string): string {
  const { hour, minute, dayPeriod, timeZoneName } = zonedParts(timestamp, TIME_OPTIONS)
  // Readers know the paper's zone, not which half of the year it is in, so EDT
  // and EST both read as ET. The tooltip's full stamp keeps the real offset.
  const zone = timeZoneName?.replace(/^([ECMP])[SD]T$/, "$1T")
  const period = dayPeriod?.toLowerCase().replace(/(.)(.)/, "$1.$2.")

  return `${hour}:${minute} ${period} ${zone}`
}

/** "Wednesday, August 20, 2026 at 6:56 p.m. ET" — the tooltip's spelled-out instant. */
export function formatFullTimestamp(timestamp: string): string {
  const { weekday, month, day, year } = zonedParts(timestamp, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return `${weekday}, ${month} ${day}, ${year} at ${formatTimeOfDay(timestamp)}`
}

/** How close two saves have to be before the second one is the same save. */
const REVISION_THRESHOLD_MS = 60_000

export interface Revision {
  /** Machine-readable instant for the `<time>` element. */
  dateTime: string
  /** "Updated 6:56 p.m. ET" on the day it ran, "Updated Aug. 21, 2026" after that. */
  label: string
}

/**
 * Payload stamps `updatedAt` on every save, so publishing is itself an update
 * and the seconds around it are not a revision. A `publishedAt` scheduled ahead
 * of the last save is not one either.
 */
export function revision(publishedAt: string, updatedAt: string): Revision | null {
  const elapsed = new Date(updatedAt).getTime() - new Date(publishedAt).getTime()
  if (!(elapsed >= REVISION_THRESHOLD_MS)) return null

  const sameDay = formatPublishedDate(updatedAt) === formatPublishedDate(publishedAt)

  return {
    dateTime: updatedAt,
    label: `Updated ${sameDay ? formatTimeOfDay(updatedAt) : formatPublishedDate(updatedAt)}`,
  }
}
