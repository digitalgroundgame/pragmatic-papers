import { describe, expect, it } from "vitest"

import {
  addDays,
  afterVisit,
  isCurrentDay,
  localDay,
  NO_VISITS,
  streakAt,
  visitsOf,
  type Visits,
} from "../days"

const at = (iso: string) => Date.parse(iso)

describe("isCurrentDay", () => {
  const now = at("2026-11-08T22:00:00Z")

  it("accepts any day it is somewhere on Earth", () => {
    // UTC−12 is still on the 8th; UTC+14 is already on the 9th.
    expect(isCurrentDay("2026-11-08", now)).toBe(true)
    expect(isCurrentDay("2026-11-09", now)).toBe(true)
  })

  it("refuses days no time zone is on, and anything that isn't a date", () => {
    expect(isCurrentDay("2026-11-07", now)).toBe(false)
    expect(isCurrentDay("2026-11-10", now)).toBe(false)
    expect(isCurrentDay("2026-02-30", at("2026-02-28T12:00:00Z"))).toBe(false)
    expect(isCurrentDay("8 Nov 2026", now)).toBe(false)
    expect(isCurrentDay(20261108, now)).toBe(false)
    expect(isCurrentDay(undefined, now)).toBe(false)
  })

  it("keeps the day before while it's still that day in the west", () => {
    expect(isCurrentDay("2026-11-07", at("2026-11-08T11:00:00Z"))).toBe(true)
    expect(isCurrentDay("2026-11-07", at("2026-11-08T12:30:00Z"))).toBe(false)
  })
})

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })
})

describe("localDay", () => {
  it("is the browser's calendar day, not UTC's", () => {
    expect(localDay(new Date(2026, 10, 8, 23, 30))).toBe("2026-11-08")
    expect(localDay(new Date(2026, 0, 2, 0, 5))).toBe("2026-01-02")
  })
})

describe("afterVisit", () => {
  const visited = (lastVisitOn: string, currentStreak: number, longestStreak = currentStreak) =>
    ({ daysVisited: 10, lastVisitOn, currentStreak, longestStreak }) satisfies Visits

  it("starts a streak on the first visit", () => {
    expect(afterVisit(NO_VISITS, "2026-11-08")).toEqual({
      daysVisited: 1,
      lastVisitOn: "2026-11-08",
      currentStreak: 1,
      longestStreak: 1,
    })
  })

  it("extends the streak on the next day, and raises the longest with it", () => {
    expect(afterVisit(visited("2026-11-07", 4), "2026-11-08")).toEqual({
      daysVisited: 11,
      lastVisitOn: "2026-11-08",
      currentStreak: 5,
      longestStreak: 5,
    })
  })

  it("starts over after a day missed, keeping the longest", () => {
    expect(afterVisit(visited("2026-11-05", 4, 9), "2026-11-08")).toEqual({
      daysVisited: 11,
      lastVisitOn: "2026-11-08",
      currentStreak: 1,
      longestStreak: 9,
    })
  })

  it("changes nothing for a second visit the same day, or one dated earlier", () => {
    expect(afterVisit(visited("2026-11-08", 4), "2026-11-08")).toBeNull()
    expect(afterVisit(visited("2026-11-08", 4), "2026-11-07")).toBeNull()
  })
})

describe("streakAt", () => {
  const visits = { daysVisited: 6, lastVisitOn: "2026-11-07", currentStreak: 6, longestStreak: 6 }

  it("runs while the last visit could be yesterday for the reader", () => {
    expect(streakAt(visits, at("2026-11-08T23:00:00Z"))).toBe(6)
    // Still the 8th in UTC−12, so the 7th is yesterday there.
    expect(streakAt(visits, at("2026-11-09T11:00:00Z"))).toBe(6)
  })

  it("is over once that day has passed everywhere", () => {
    expect(streakAt(visits, at("2026-11-09T13:00:00Z"))).toBe(0)
    expect(streakAt(NO_VISITS, Date.now())).toBe(0)
  })
})

describe("visitsOf", () => {
  it("reads the group, and treats anything missing as nothing yet", () => {
    expect(visitsOf({ reading: { daysVisited: 3, lastVisitOn: "2026-11-08" } }, "reading")).toEqual(
      { daysVisited: 3, lastVisitOn: "2026-11-08", currentStreak: 0, longestStreak: 0 },
    )
    expect(visitsOf({}, "reading")).toEqual(NO_VISITS)
    expect(visitsOf({ reading: null }, "reading")).toEqual(NO_VISITS)
  })
})
