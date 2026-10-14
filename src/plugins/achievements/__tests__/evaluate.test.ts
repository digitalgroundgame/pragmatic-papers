import { describe, expect, it } from "vitest"

import { resolveAchievementsConfig } from ".."
import { heldAchievements, topBadge } from "../evaluate"
import type { AchievementDefinition, AchievementRow } from "../types"

const config = resolveAchievementsConfig({
  currentUser: async () => null,
  isMember: () => true,
  moderators: () => true,
  admins: () => true,
})

const reader = (fields: Record<string, unknown> = {}) => ({ id: 7, ...fields })
const row = (achievement: string, fields: Partial<AchievementRow> = {}): AchievementRow => ({
  user: 7,
  achievement,
  earnedAt: "2026-10-18T12:00:00.000Z",
  revoked: false,
  ...fields,
})
const keys = (held: { key: string }[]) => held.map(({ key }) => key)

describe("heldAchievements", () => {
  it("gives Verified to an account whose address is verified, with no row", () => {
    expect(keys(heldAchievements(reader({ emailVerified: true }), [], config))).toEqual([
      "verified",
    ])
    expect(heldAchievements(reader({ emailVerified: false }), [], config)).toEqual([])
    expect(heldAchievements(reader(), [], config)).toEqual([])
  })

  it("follows the address: Verified goes once it isn't verified, whatever rows say", () => {
    expect(heldAchievements(reader({ emailVerified: false }), [row("verified")], config)).toEqual(
      [],
    )
  })

  it("gives Early member only to an account with a row for it, with when it was earned", () => {
    expect(heldAchievements(reader(), [row("early-member")], config)).toEqual([
      {
        key: "early-member",
        label: "Early member",
        description: expect.any(String),
        badge: "Early member",
        earnedAt: "2026-10-18T12:00:00.000Z",
      },
    ])
  })

  it("takes away a revoked achievement, worked out from the account or awarded", () => {
    const rows = [row("verified", { revoked: true }), row("early-member", { revoked: true })]
    expect(heldAchievements(reader({ emailVerified: true }), rows, config)).toEqual([])
  })

  it("lists the one with the highest-priority badge first", () => {
    const held = heldAchievements(reader({ emailVerified: true }), [row("early-member")], config)
    expect(keys(held)).toEqual(["early-member", "verified"])
    expect(held[1]).toMatchObject({ earnedAt: null })
  })

  it("lists an achievement without a badge last", () => {
    const registry: AchievementDefinition[] = [
      { key: "quiet", label: "Quiet", description: "", source: "awarded" },
      {
        key: "loud",
        label: "Loud",
        description: "",
        source: "awarded",
        badge: { label: "Loud", priority: 1 },
      },
    ]
    const held = heldAchievements(reader(), [row("quiet"), row("loud")], config, registry)
    expect(keys(held)).toEqual(["loud", "quiet"])
    expect(topBadge(held)).toBe("Loud")
    expect(topBadge(held.slice(1))).toBeNull()
  })
})

describe("topBadge", () => {
  it("is the badge of the highest-priority achievement held, or null for none", () => {
    expect(
      topBadge(heldAchievements(reader({ emailVerified: true }), [row("early-member")], config)),
    ).toBe("Early member")
    expect(topBadge(heldAchievements(reader({ emailVerified: true }), [], config))).toBe("Verified")
    expect(topBadge([])).toBeNull()
  })
})
