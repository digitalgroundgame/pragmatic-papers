import { describe, expect, it } from "vitest"

import { formatStartsAt } from "../startsAt"

describe("formatStartsAt", () => {
  // 7:00 p.m. ET on Wednesday, Oct. 7, 2026.
  const startsAt = "2026-10-07T23:00:00Z"

  it("is the time alone on the same day in the paper's zone", () => {
    expect(formatStartsAt(startsAt, new Date("2026-10-07T12:00:00Z"))).toBe("7:00 p.m. ET")
  })

  it("names the weekday on another day, judged in the paper's zone rather than UTC", () => {
    // 11:30 p.m. ET on Tuesday is already Wednesday in UTC.
    expect(formatStartsAt(startsAt, new Date("2026-10-07T03:30:00Z"))).toBe(
      "Wednesday 7:00 p.m. ET",
    )
  })
})
