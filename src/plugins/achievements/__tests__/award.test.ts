import type { PayloadRequest } from "payload"
import { describe, expect, it } from "vitest"

import { resolveAchievementsConfig } from ".."
import { awardEarlyMember, backfillEarlyMembers } from "../award"
import { ACHIEVEMENTS_SLUG, AWARDING, EARLY_MEMBER } from "../constants"
import { awardOnMembership, deleteUsersAchievements } from "../hooks/users"
import type { AchievementsPluginConfig } from "../types"

import { fakePayload } from "./fakePayload"

const options: AchievementsPluginConfig = {
  currentUser: async () => null,
  isMember: (user) => Array.isArray(user.roles) && user.roles.includes("member"),
  moderators: () => true,
  admins: () => true,
  earlyMemberLimit: 2,
}
const config = resolveAchievementsConfig(options)

const member = (id: number, day: number) => ({
  id,
  roles: ["member"],
  createdAt: `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`,
})
const holders = (rows: Record<string, unknown>[]) =>
  rows.filter((row) => row.achievement === EARLY_MEMBER).map((row) => row.user)

describe("awardEarlyMember", () => {
  it("awards until the limit, as the plugin's own write, once per account", async () => {
    const { payload, store } = fakePayload()

    expect(await awardEarlyMember(payload, 1, config)).toBe(true)
    expect(await awardEarlyMember(payload, 1, config)).toBe(false)
    expect(await awardEarlyMember(payload, 2, config)).toBe(true)
    expect(await awardEarlyMember(payload, 3, config)).toBe(false)

    expect(holders(store[ACHIEVEMENTS_SLUG]!)).toEqual([1, 2])
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ context: { [AWARDING]: true }, overrideAccess: true }),
    )
  })

  it("counts revoked rows and rows whose account is gone, so nobody later moves up", async () => {
    const { payload } = fakePayload({
      rows: [
        { id: 1, user: 1, achievement: EARLY_MEMBER, revoked: true },
        { id: 2, user: null, achievement: EARLY_MEMBER },
      ],
    })
    expect(await awardEarlyMember(payload, 3, config)).toBe(false)
  })

  it("awards nothing when the plugin is disabled in code", async () => {
    const { payload } = fakePayload()
    const disabled = resolveAchievementsConfig({ ...options, disabled: true })
    expect(await awardEarlyMember(payload, 1, disabled)).toBe(false)
    expect(payload.create).not.toHaveBeenCalled()
  })
})

describe("backfillEarlyMembers", () => {
  it("awards existing members in sign-up order, skipping staff, then never again", async () => {
    const { payload, store } = fakePayload({
      users: [
        member(3, 3),
        { id: 9, roles: ["editor"], createdAt: "2026-01-01T00:00:00.000Z" },
        member(1, 5),
        member(2, 1),
      ],
    })

    expect(await backfillEarlyMembers(payload, config)).toBe(2)
    expect(holders(store[ACHIEVEMENTS_SLUG]!)).toEqual([2, 3])

    store[ACHIEVEMENTS_SLUG] = []
    expect(await backfillEarlyMembers(payload, config)).toBeNull()
    expect(store[ACHIEVEMENTS_SLUG]).toEqual([])
  })

  it("leaves room for members already awarded", async () => {
    const { payload, store } = fakePayload({
      users: [member(1, 1), member(2, 2), member(3, 3)],
      rows: [{ id: 1, user: 3, achievement: EARLY_MEMBER }],
    })
    expect(await backfillEarlyMembers(payload, config)).toBe(1)
    expect(holders(store[ACHIEVEMENTS_SLUG]!)).toEqual([3, 1])
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

  it("awards an account made as a member, or that just became one", async () => {
    const { payload, store } = fakePayload()
    await run(payload, member(1, 1), "create")
    await run(payload, member(2, 2), "update", { id: 2, roles: [] })
    expect(holders(store[ACHIEVEMENTS_SLUG]!)).toEqual([1, 2])
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

describe("deleteUsersAchievements", () => {
  it("deletes an account's rows but keeps its Early member row, without the account", async () => {
    const { payload, store } = fakePayload({
      rows: [
        { id: 1, user: 1, achievement: EARLY_MEMBER },
        { id: 2, user: 1, achievement: "verified", revoked: true },
        { id: 3, user: 2, achievement: "verified", revoked: true },
      ],
    })
    await deleteUsersAchievements({ id: 1, req: { payload } } as never)
    expect(store[ACHIEVEMENTS_SLUG]).toEqual([
      { id: 1, user: null, achievement: EARLY_MEMBER },
      { id: 3, user: 2, achievement: "verified", revoked: true },
    ])
  })
})
