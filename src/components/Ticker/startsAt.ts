import { PUBLICATION_TIME_ZONE, formatTimeOfDay } from "@/heros/ArticleHero/dates"

/** The calendar day an instant falls on in the paper's zone, e.g. "10/7/2026". */
const zonedDay = (instant: Date): string =>
  instant.toLocaleDateString("en-US", { timeZone: PUBLICATION_TIME_ZONE })

/**
 * When an upcoming broadcast starts, as the ticker labels it: "7:00 p.m. ET" when that's
 * today in the paper's zone, else "Friday 7:00 p.m. ET". The Header caps the window at six
 * days, so a weekday never names a day a week out.
 */
export function formatStartsAt(startsAt: string, now: Date = new Date()): string {
  const time = formatTimeOfDay(startsAt)
  const start = new Date(startsAt)
  if (zonedDay(start) === zonedDay(now)) return time
  const weekday = start.toLocaleDateString("en-US", {
    timeZone: PUBLICATION_TIME_ZONE,
    weekday: "long",
  })
  return `${weekday} ${time}`
}
