import { describe, expect, it } from "vitest"

import { lockFor, type Violation } from "../lock"

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse("2026-10-13T12:00:00.000Z")
const settings = { violationThreshold: 3, violationWindowDays: 30 }

const ago = (days: number, source: Violation["source"] = "check"): Violation => ({
  source,
  createdAt: new Date(now - days * DAY).toISOString(),
})

describe("lockFor", () => {
  it("leaves an account with fewer violations than the threshold alone", () => {
    expect(lockFor([ago(1), ago(2)], settings, now)).toBeNull()
  })

  it("locks at the threshold, until the oldest of them ages out", () => {
    expect(lockFor([ago(1), ago(5), ago(10)], settings, now)).toEqual({
      until: new Date(now - 10 * DAY + 30 * DAY).toISOString(),
    })
  })

  it("over the threshold, waits until only threshold - 1 remain", () => {
    // Four active: the lock lifts once two have aged out, so at the second-oldest's expiry.
    expect(lockFor([ago(1), ago(5), ago(10), ago(20)], settings, now)).toEqual({
      until: new Date(now - 10 * DAY + 30 * DAY).toISOString(),
    })
  })

  it("doesn't count violations older than the window", () => {
    expect(lockFor([ago(1), ago(5), ago(31)], settings, now)).toBeNull()
  })

  it("holds a block until it's reversed, however old", () => {
    expect(lockFor([ago(400, "block")], settings, now)).toEqual({ until: null })
  })
})
