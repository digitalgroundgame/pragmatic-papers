import { describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import {
  countdownLine,
  daysUntilVote,
  headToHead,
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
    expect(headToHead(counted)[0]).toMatchObject({ backs: 3, leans: 1 })
  })

  it("counts the days to the vote, a part day as one, and stops at the vote", () => {
    expect(daysUntilVote(whipCountData, now)).toBeNull()
    expect(countdownLine(whipCountData, now)).toBeNull()
    expect(daysUntilVote(voting, now)).toBe(17)
    expect(countdownLine(voting, now)).toBe("17 days to the vote")
    expect(countdownLine(voting, new Date("2026-11-30T20:00:00Z"))).toBe("1 day to the vote")
    expect(countdownLine(voting, new Date("2026-12-02T00:00:00Z"))).toBe("Vote day")
  })

  it("names a new image when the count or the day changes, and the same one otherwise", () => {
    const path = whipCountImagePath("leader", whipCountData, now)
    expect(path).toMatch(/^\/next\/whip-counts\/leader\/image\?v=[0-9a-z]+-2026-11-14$/)
    expect(whipCountImagePath("leader", whipCountData, now)).toBe(path)
    expect(whipCountImagePath("leader", { ...whipCountData, asOf: "2026-11-14" }, now)).not.toBe(
      path,
    )
    expect(whipCountImagePath("leader", whipCountData, new Date("2026-11-15T01:00:00Z"))).not.toBe(
      path,
    )
  })
})
