import { describe, expect, it } from "vitest"

import { resolveAchievementsConfig } from ".."
import { heldAchievements, relationId, topBadge } from "../evaluate"
import type { AchievementDoc, AchievementRow } from "../types"

const config = resolveAchievementsConfig({
  currentUser: async () => null,
  isMember: () => true,
  moderators: () => true,
  admins: () => true,
})

const early: AchievementDoc = {
  id: 1,
  name: "Early member",
  description: "One of the first.",
  rule: "firstMembers",
  limit: 1000,
  badge: true,
}
const verified: AchievementDoc = { id: 2, name: "Verified", rule: "verified", badge: true }
const helper: AchievementDoc = { id: 3, name: "Helper", rule: "manual", badge: false }
const achievements = [early, verified, helper]

const reader = (fields: Record<string, unknown> = {}) => ({ id: 7, ...fields })
const row = (achievement: number, fields: Partial<AchievementRow> = {}): AchievementRow => ({
  user: 7,
  achievement,
  earnedAt: "2026-10-18T12:00:00.000Z",
  revoked: false,
  ...fields,
})
const keys = (held: { key: string }[]) => held.map(({ key }) => key)
const held = (user: Record<string, unknown>, rows: AchievementRow[], list = achievements) =>
  heldAchievements(reader(user), rows, list, config)

describe("heldAchievements", () => {
  it("works out an account achievement from the user, with no row", () => {
    expect(keys(held({ emailVerified: true }, []))).toEqual(["2"])
    expect(held({ emailVerified: true }, [])[0]).toEqual({
      key: "2",
      label: "Verified",
      description: "",
      badge: "Verified",
      earnedAt: null,
    })
    expect(held({ emailVerified: false }, [])).toEqual([])
  })

  it("needs a row for an awarded or hand-given one", () => {
    expect(keys(held({}, [row(1), row(3)]))).toEqual(["1", "3"])
    expect(keys(held({}, []))).toEqual([])
  })

  it("lists them in the order editors gave the achievements, with when each was earned", () => {
    const list = held({ emailVerified: true }, [row(3, { earnedAt: "then" }), row(1)])
    expect(keys(list)).toEqual(["1", "2", "3"])
    expect(list[0]).toMatchObject({ label: "Early member", description: "One of the first." })
    expect(list[2]).toMatchObject({ badge: null, earnedAt: "then" })
    expect(keys(held({ emailVerified: true }, [row(1)], [verified, early]))).toEqual(["2", "1"])
  })

  it("takes away any achievement with a revoked row", () => {
    expect(held({ emailVerified: true }, [row(2, { revoked: true })])).toEqual([])
    expect(held({}, [row(1, { revoked: true })])).toEqual([])
  })

  it("reads populated relationships too", () => {
    expect(keys(held({}, [row(1, { achievement: { id: 1 } })]))).toEqual(["1"])
  })

  it("leaves out an achievement whose rule is no longer in the code", () => {
    const gone: AchievementDoc = { id: 9, name: "Gone", rule: "removed" }
    expect(held({}, [row(9)], [gone])).toEqual([])
  })

  it("uses the host's own idea of verified", () => {
    const strict = resolveAchievementsConfig({
      currentUser: async () => null,
      isMember: () => true,
      moderators: () => true,
      admins: () => true,
      isVerified: (user) => user.trusted === true,
    })
    expect(heldAchievements(reader({ emailVerified: true }), [], achievements, strict)).toEqual([])
    expect(keys(heldAchievements(reader({ trusted: true }), [], achievements, strict))).toEqual([
      "2",
    ])
  })
})

describe("topBadge", () => {
  it("is the first achievement held that has a badge", () => {
    expect(topBadge(held({ emailVerified: true }, [row(1), row(3)]))).toBe("Early member")
    expect(topBadge(held({}, [row(3)]))).toBeNull()
    expect(topBadge([])).toBeNull()
  })
})

describe("relationId", () => {
  it("reads an ID, populated or not, and null for none", () => {
    expect(relationId(4)).toBe("4")
    expect(relationId({ id: 4 })).toBe("4")
    expect(relationId(null)).toBeNull()
  })
})
