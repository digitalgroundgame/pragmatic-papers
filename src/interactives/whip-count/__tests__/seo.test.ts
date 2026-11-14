import { describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import {
  countdownLine,
  daysUntilVote,
  headToHead,
  updatedLine,
  whipCountImagePath,
  whipCountTitle,
} from "../seo"

const now = new Date("2026-11-14T17:00:00Z")
const voting = { ...whipCountData, voteAt: "2026-12-01T09:30:00-05:00" }

describe("whip count SEO", () => {
  it("puts both candidates' public backers in the title, ahead of the page's own", () => {
    expect(whipCountTitle("Who leads?", whipCountData)).toBe(
      "Marion Hale 3, Daniel Ortiz 2: Who leads?",
    )
  })

  it("counts as the page opens, without the outgoing", () => {
    const counted = {
      ...whipCountData,
      members: whipCountData.members.map((m) =>
        m.seat === "outgoing" ? { ...m, stance: "backs" as const, candidate: "hale" } : m,
      ),
    }
    expect(headToHead(counted)[0]).toMatchObject({ backs: 3, leans: 1, forecast: null })
    expect(headToHead(counted)[1]?.forecast).toMatchObject({ refusals: 1, total: 3 })
  })

  it("counts the days to the vote, a part day as one, and stops at the vote", () => {
    expect(daysUntilVote(whipCountData, now)).toBeNull()
    expect(countdownLine(whipCountData, now)).toBeNull()
    expect(daysUntilVote(voting, now)).toBe(17)
    expect(countdownLine(voting, now)).toBe("17 days to the vote")
    expect(countdownLine(voting, new Date("2026-11-30T20:00:00Z"))).toBe("1 day to the vote")
    expect(countdownLine(voting, new Date("2026-12-01T14:00:00Z"))).toBe("1 day to the vote")
    expect(daysUntilVote(voting, new Date("2026-12-01T15:00:00Z"))).toBe(0)
    expect(countdownLine(voting, new Date("2026-12-01T15:00:00Z"))).toBeNull()
    expect(countdownLine(voting, new Date("2026-12-05T00:00:00Z"))).toBeNull()
  })

  it("names a new image when the count or the countdown changes, and the same one otherwise", () => {
    const path = whipCountImagePath("leader", whipCountData, now)
    expect(path).toMatch(/^\/next\/whip-counts\/leader\/image\?v=[0-9a-z]+-none$/)
    expect(whipCountImagePath("leader", whipCountData, new Date("2026-11-20T00:00:00Z"))).toBe(path)
    expect(whipCountImagePath("leader", { ...whipCountData, asOf: "2026-11-14" }, now)).not.toBe(
      path,
    )

    // The countdown ticks at the vote's time of day (14:30 UTC), not at midnight.
    const counting = whipCountImagePath("leader", voting, now)
    expect(counting).toMatch(/-17$/)
    expect(whipCountImagePath("leader", voting, new Date("2026-11-15T14:00:00Z"))).toBe(counting)
    expect(whipCountImagePath("leader", voting, new Date("2026-11-15T15:00:00Z"))).toMatch(/-16$/)
  })

  describe("updatedLine", () => {
    it("names the time of day the count last changed, in its schedule's zone", () => {
      const at = "2026-11-14T19:37:00Z"
      expect(updatedLine(whipCountData, at)).toBe("WHIP COUNT · UPDATED NOV 14, 2:37 PM EST")
      const pacific = {
        ...whipCountData,
        updates: { times: ["09:00"], timeZone: "America/Los_Angeles" },
      }
      expect(updatedLine(pacific, at)).toBe("WHIP COUNT · UPDATED NOV 14, 11:37 AM PST")
    })

    it("falls back to the count's own date", () => {
      expect(updatedLine(whipCountData)).toBe("WHIP COUNT · AS OF NOVEMBER 13, 2026")
      expect(updatedLine(whipCountData, "not a date")).toBe("WHIP COUNT · AS OF NOVEMBER 13, 2026")
    })
  })
})
