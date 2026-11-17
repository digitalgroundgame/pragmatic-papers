/**
 * Calendar days, as `YYYY-MM-DD`. A visit counts on the reader's own day, which the browser
 * sends, so a reader in California who visits at 7pm and again at 9pm visits once, not on two
 * days as UTC would have it. The server accepts any day some time zone is on right now.
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** The time zones furthest behind and ahead of UTC: UTC−12 and UTC+14. */
const BEHIND_MS = 12 * 60 * 60 * 1000
const AHEAD_MS = 14 * 60 * 60 * 1000

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The UTC calendar day of `time`. */
export const utcDay = (time: number): string => new Date(time).toISOString().slice(0, 10)

/** The day before or after `day`, `by` days on. */
export const addDays = (day: string, by: number): string =>
  utcDay(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS)

/** The calendar day where the browser is, for the page to send. */
export const localDay = (date: Date = new Date()): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")

/** Whether `day` is a real date that it is somewhere on Earth at `now`. */
export function isCurrentDay(day: unknown, now: number): day is string {
  if (typeof day !== "string" || !DAY.test(day)) return false
  if (utcDay(Date.parse(`${day}T00:00:00Z`)) !== day) return false
  return day >= utcDay(now - BEHIND_MS) && day <= utcDay(now + AHEAD_MS)
}

/** A reader's visits, as the fields on their account keep them. */
export interface Visits {
  daysVisited: number
  /** The last day they visited, on their calendar. */
  lastVisitOn: string | null
  /** Days in a row, ending on `lastVisitOn`. */
  currentStreak: number
  longestStreak: number
}

export const NO_VISITS: Visits = {
  daysVisited: 0,
  lastVisitOn: null,
  currentStreak: 0,
  longestStreak: 0,
}

/**
 * The visits after one on `day`, or null when it changes nothing: a second visit the same day,
 * or one dated before the last (a tab left open across midnight, or a clock set back).
 */
export function afterVisit(visits: Visits, day: string): Visits | null {
  const last = visits.lastVisitOn
  if (last && day <= last) return null
  const currentStreak = last && addDays(last, 1) === day ? visits.currentStreak + 1 : 1
  return {
    daysVisited: visits.daysVisited + 1,
    lastVisitOn: day,
    currentStreak,
    longestStreak: Math.max(visits.longestStreak, currentStreak),
  }
}

/**
 * The streak as it stands at `now`: still running while the last visit could be today or
 * yesterday on the reader's calendar, and over once it can't.
 */
export function streakAt(visits: Visits, now: number): number {
  if (!visits.lastVisitOn) return 0
  const yesterdayAtTheEarliest = addDays(utcDay(now - BEHIND_MS), -1)
  return visits.lastVisitOn >= yesterdayAtTheEarliest ? visits.currentStreak : 0
}

/** A user's visits from the group on their record, whatever shape it's in. */
export function visitsOf(user: Record<string, unknown>, field: string): Visits {
  const group = user[field]
  if (!group || typeof group !== "object") return NO_VISITS
  const value = group as Record<string, unknown>
  const count = (key: string) =>
    typeof value[key] === "number" && Number.isFinite(value[key]) ? (value[key] as number) : 0
  return {
    daysVisited: count("daysVisited"),
    lastVisitOn: typeof value.lastVisitOn === "string" ? value.lastVisitOn : null,
    currentStreak: count("currentStreak"),
    longestStreak: count("longestStreak"),
  }
}
