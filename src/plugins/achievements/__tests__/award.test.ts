import type { PayloadRequest } from "payload"
import { describe, expect, it } from "vitest"

import { resolveAchievementsConfig } from ".."
import { awardFirstMember, fillFirstMembers, seedAchievements } from "../award"
import { ACHIEVEMENTS_SLUG, AWARDING, AWARDS_SLUG } from "../constants"
import { awardOnMembership, deleteUsersAwards } from "../hooks/users"
import type { AchievementDoc, AchievementsPluginConfig } from "../types"

import { fakePayload } from "./fakePayload"

const options: AchievementsPluginConfig = {
  currentUser: async () => null,
  isMember: (user) => Array.isArray(user.roles) && user.roles.includes("member"),
  moderators: () => true,
  admins: () => true,
  earlyMemberLimit: 2,
}
const config = resolveAchievementsConfig(options)

/** The fake's Early member: the first two members. */
const early: AchievementDoc = { id: 1, name: "Early member", rule: "firstMembers", limit: 2 }

const member = (id: number, day: number) => ({
  id,
  roles: ["member"],
  createdAt: `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`,
})
const holders = (rows: Record<string, unknown>[], achievement = 1) =>
  rows.filter((row) => row.achievement === achievement).map((row) => row.user)

describe("awardFirstMember", () => {
  it("awards until the limit, as the plugin's own write, once per account", async () => {
    const { payload, store } = fakePayload()

    expect(await awardFirstMember(payload, early, 1)).toBe(true)
    expect(await awardFirstMember(payload, early, 1)).toBe(false)
    expect(await awardFirstMember(payload, early, 2)).toBe(true)
    expect(await awardFirstMember(payload, early, 3)).toBe(false)

    expect(holders(store[AWARDS_SLUG]!)).toEqual([1, 2])
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ context: { [AWARDING]: true }, overrideAccess: true }),
    )
  })

  it("counts revoked rows and rows whose account is gone, so nobody later moves up", async () => {
    const { payload } = fakePayload({
      rows: [
        { id: 1, user: 1, achievement: 1, revoked: true },
        { id: 2, user: null, achievement: 1 },
      ],
    })
    expect(await awardFirstMember(payload, early, 3)).toBe(false)
  })

  it("counts each achievement's awards apart", async () => {
    const { payload } = fakePayload({ rows: [{ id: 1, user: 1, achievement: 5 }] })
    expect(await awardFirstMember(payload, { ...early, limit: 1 }, 2)).toBe(true)
  })

  it("awards nothing without a limit", async () => {
    const { payload } = fakePayload()
    expect(await awardFirstMember(payload, { ...early, limit: null }, 1)).toBe(false)
  })
})

describe("fillFirstMembers", () => {
  it("awards existing members in sign-up order, skipping staff, and is safe to run again", async () => {
    const { payload, store } = fakePayload({
      users: [
        member(3, 3),
        { id: 9, roles: ["editor"], createdAt: "2026-01-01T00:00:00.000Z" },
        member(1, 5),
        member(2, 1),
      ],
    })

    expect(await fillFirstMembers(payload, early, config)).toBe(2)
    expect(holders(store[AWARDS_SLUG]!)).toEqual([2, 3])
    expect(payload.logger.info).toHaveBeenCalledOnce()

    expect(await fillFirstMembers(payload, early, config)).toBe(0)
    expect(holders(store[AWARDS_SLUG]!)).toEqual([2, 3])
  })

  it("leaves room for members already awarded, and fills a raised limit", async () => {
    const { payload, store } = fakePayload({
      users: [member(1, 1), member(2, 2), member(3, 3)],
      rows: [{ id: 1, user: 3, achievement: 1 }],
    })
    expect(await fillFirstMembers(payload, early, config)).toBe(1)
    expect(holders(store[AWARDS_SLUG]!)).toEqual([3, 1])
    expect(await fillFirstMembers(payload, { ...early, limit: 3 }, config)).toBe(1)
    expect(holders(store[AWARDS_SLUG]!)).toEqual([3, 1, 2])
  })

  it("reads every page of users", async () => {
    const users = Array.from({ length: 501 }, (_, i) => ({
      id: i + 1,
      roles: i === 500 ? ["member"] : ["editor"],
      createdAt: `2026-01-01T00:00:${String(i).padStart(4, "0")}`,
    }))
    const { payload, store } = fakePayload({ users })
    expect(await fillFirstMembers(payload, early, config)).toBe(1)
    expect(holders(store[AWARDS_SLUG]!)).toEqual([501])
  })

  it("awards nothing without a limit", async () => {
    const { payload } = fakePayload({ users: [member(1, 1)] })
    expect(await fillFirstMembers(payload, { ...early, limit: null }, config)).toBe(0)
    expect(payload.create).not.toHaveBeenCalled()
  })
})

describe("seedAchievements", () => {
  it("creates Verified and Early member once per site, and never again once deleted", async () => {
    const { payload, store } = fakePayload({ achievements: [] })

    expect(await seedAchievements(payload, config)).toEqual(["Early member", "Verified"])
    expect(store[ACHIEVEMENTS_SLUG]).toEqual([
      expect.objectContaining({ name: "Early member", rule: "firstMembers", limit: 2 }),
      expect.objectContaining({ name: "Verified", rule: "verified", badge: true }),
    ])
    expect(store[ACHIEVEMENTS_SLUG]![0]).not.toHaveProperty("key")

    store[ACHIEVEMENTS_SLUG] = []
    expect(await seedAchievements(payload, config)).toEqual([])
    expect(store[ACHIEVEMENTS_SLUG]).toEqual([])
  })

  it("takes one another deploy already created as seeded, rather than making a second", async () => {
    const { payload, store, kv } = fakePayload()

    expect(await seedAchievements(payload, config)).toEqual([])
    expect(store[ACHIEVEMENTS_SLUG]).toHaveLength(2)
    expect(payload.create).not.toHaveBeenCalled()
    expect([...kv.keys()]).toEqual([
      "seeded:achievements:early-member",
      "seeded:achievements:verified",
      "seeded:awards:filled-1",
    ])
  })

  it("fills an Early member that was never filled, once, so a deleted award stays deleted", async () => {
    const { payload, store } = fakePayload({ users: [member(1, 1), member(2, 2), member(3, 3)] })
    await seedAchievements(payload, config)
    expect(holders(store[AWARDS_SLUG]!)).toEqual([1, 2])

    store[AWARDS_SLUG] = store[AWARDS_SLUG]!.filter((row) => row.user !== 1)
    expect(await seedAchievements(payload, config)).toEqual([])
    expect(holders(store[AWARDS_SLUG]!)).toEqual([2])
  })

  it("creates nothing when the plugin is disabled in code", async () => {
    const { payload } = fakePayload({ achievements: [] })
    const disabled = resolveAchievementsConfig({ ...options, disabled: true })
    expect(await seedAchievements(payload, disabled)).toEqual([])
    expect(payload.create).not.toHaveBeenCalled()
  })
})

describe("awardOnMembership", () => {
  const hook = awardOnMembership(config)
  const run = (
    payload: ReturnType<typeof fakePayload>["payload"],
    doc: object,
    operation: "create" | "update",
    previousDoc?: object,
  ) => hook({ doc, previousDoc, operation, req: { payload } as unknown as PayloadRequest } as never)

  it("awards every first-members achievement to an account made as a member, or that just became one", async () => {
    const { payload, store } = fakePayload()
    store[ACHIEVEMENTS_SLUG]!.push({ id: 5, name: "Founding", rule: "firstMembers", limit: 1 })
    await run(payload, member(1, 1), "create")
    await run(payload, member(2, 2), "update", { id: 2, roles: [] })
    expect(holders(store[AWARDS_SLUG]!)).toEqual([1, 2])
    expect(holders(store[AWARDS_SLUG]!, 5)).toEqual([1])
  })

  it("leaves staff, and an edit to an account that was already a member", async () => {
    const { payload } = fakePayload()
    await run(payload, { id: 1, roles: ["editor"] }, "create")
    await run(payload, member(2, 2), "update", member(2, 2))
    expect(payload.create).not.toHaveBeenCalled()
  })

  it("logs a failure rather than stopping the save", async () => {
    const { payload } = fakePayload()
    payload.count.mockRejectedValueOnce(new Error("down"))
    const doc = member(1, 1)
    await expect(run(payload, doc, "create")).resolves.toBe(doc)
    expect(payload.logger.error).toHaveBeenCalled()
  })
})

describe("deleteUsersAwards", () => {
  it("deletes an account's awards but keeps its first-members ones, without the account", async () => {
    const { payload, store } = fakePayload({
      rows: [
        { id: 1, user: 1, achievement: 1 },
        { id: 2, user: 1, achievement: 2, revoked: true },
        { id: 3, user: 2, achievement: 2, revoked: true },
      ],
    })
    await deleteUsersAwards({ id: 1, req: { payload } } as never)
    expect(store[AWARDS_SLUG]).toEqual([
      { id: 1, user: null, achievement: 1 },
      { id: 3, user: 2, achievement: 2, revoked: true },
    ])
  })

  it("deletes them all when no achievement goes to first members", async () => {
    const { payload, store } = fakePayload({
      achievements: [],
      rows: [{ id: 1, user: 1, achievement: 7 }],
    })
    await deleteUsersAwards({ id: 1, req: { payload } } as never)
    expect(store[AWARDS_SLUG]).toEqual([])
  })
})
