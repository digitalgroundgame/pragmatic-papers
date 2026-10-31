import type { CollectionConfig, Config, Field, PayloadRequest } from "payload"
import { describe, expect, it } from "vitest"

import { achievementsPlugin, type AchievementsPluginConfig, resolveAchievementsConfig } from ".."
import { awardChanges, deleteAchievementsAwards, fillOnSave } from "../collection"
import { ACHIEVEMENTS_SLUG, AWARDING, AWARDS_SLUG } from "../constants"
import { registeredPlugins } from "@/utilities/registerPlugin"

import { fakePayload } from "./fakePayload"

const moderators = () => true
const admins = () => false
const options: AchievementsPluginConfig = {
  currentUser: async () => null,
  isMember: (user) => Array.isArray(user.roles) && user.roles.includes("member"),
  moderators,
  admins,
}

const existingHook = () => undefined
const existingField: Field = { name: "email", type: "email" }
const users: CollectionConfig = {
  slug: "users",
  auth: true,
  fields: [existingField],
  hooks: { afterChange: [existingHook] },
}
const pages: CollectionConfig = { slug: "pages", fields: [] }

const apply = (pluginOptions: AchievementsPluginConfig) =>
  achievementsPlugin(pluginOptions)({ collections: [users, pages] } as Config) as Config
const collection = (config: Config, slug: string) =>
  config.collections!.find((c) => c.slug === slug)!
const field = (c: CollectionConfig, name: string) =>
  c.fields.find((f) => "name" in f && f.name === name) as Field & Record<string, never>

describe("achievementsPlugin", () => {
  it("adds Achievements for editors to define, ordered by dragging", () => {
    const config = apply(options)
    const achievements = collection(config, ACHIEVEMENTS_SLUG)

    expect(config.collections!.map(({ slug }) => slug)).toEqual([
      "users",
      "pages",
      ACHIEVEMENTS_SLUG,
      AWARDS_SLUG,
    ])
    expect(achievements.admin?.group).toBe("Content")
    expect(achievements.orderable).toBe(true)
    expect(achievements.access).toMatchObject({
      read: moderators,
      create: moderators,
      update: moderators,
      delete: admins,
    })
    expect(achievements.endpoints).toHaveLength(1)
    expect(achievements.hooks?.afterChange).toHaveLength(1)
  })

  it("fixes an achievement's rule once it's made, and asks first members for a limit", () => {
    const achievements = collection(apply(options), ACHIEVEMENTS_SLUG)
    const rule = field(achievements, "rule")
    expect((rule.access as { update: () => boolean }).update()).toBe(false)
    expect((rule.options as { value: string }[]).map(({ value }) => value)).toEqual([
      "manual",
      "firstMembers",
      "verified",
    ])

    const limit = field(achievements, "limit") as unknown as {
      validate: (value: unknown, args: { siblingData: Record<string, unknown> }) => unknown
      admin: { condition: (data: unknown, sibling: Record<string, unknown>) => boolean }
    }
    expect(limit.validate(undefined, { siblingData: { rule: "firstMembers" } })).toBe(
      "Say how many members get it.",
    )
    expect(limit.validate(0, { siblingData: { rule: "firstMembers" } })).toBeTypeOf("string")
    expect(limit.validate(100, { siblingData: { rule: "firstMembers" } })).toBe(true)
    expect(limit.validate(undefined, { siblingData: { rule: "manual" } })).toBe(true)
    expect(limit.admin.condition({}, { rule: "firstMembers" })).toBe(true)
    expect(limit.admin.condition({}, { rule: "verified" })).toBe(false)
  })

  it("adds Awards off the sidebar, one row per user and achievement, only admins deleting", () => {
    const awards = collection(apply(options), AWARDS_SLUG)
    expect(awards.admin?.group).toBe(false)
    expect(awards.labels).toEqual({ singular: "Award", plural: "Awards" })
    expect(awards.access).toMatchObject({ read: moderators, delete: admins })
    expect(awards.indexes).toEqual([{ fields: ["user", "achievement"], unique: true }])

    const user = field(awards, "user") as unknown as {
      validate: (value: unknown, args: { operation?: string }) => unknown
    }
    expect(user.validate(null, { operation: "create" })).toBe("Choose the user.")
    expect(user.validate(null, { operation: "update" })).toBe(true)

    const reason = field(awards, "revokedReason") as unknown as {
      validate: (value: unknown, args: { siblingData: Record<string, unknown> }) => unknown
      admin: { condition: (data: unknown, sibling: Record<string, unknown>) => boolean }
    }
    expect(reason.validate(" ", { siblingData: { revoked: true } })).toBe(
      "Give a reason for revoking it.",
    )
    expect(reason.validate("Spam", { siblingData: { revoked: true } })).toBe(true)
    expect(reason.validate(undefined, { siblingData: { revoked: false } })).toBe(true)
    expect(reason.admin.condition({}, { revoked: true })).toBe(true)
  })

  it("lists a user's awards on their record, for moderators, and hooks the users collection", async () => {
    const config = apply(options)
    const usersConfig = collection(config, "users")
    expect(usersConfig.fields[0]).toBe(existingField)
    const join = field(usersConfig, "awards") as unknown as {
      type: string
      collection: string
      on: string
      admin: { allowCreate: boolean }
      access: { read: (args: unknown) => Promise<boolean> }
    }
    expect(join).toMatchObject({ type: "join", collection: AWARDS_SLUG, on: "user" })
    expect(join.admin.allowCreate).toBe(true)
    await expect(join.access.read({})).resolves.toBe(true)
    const strict = collection(apply({ ...options, moderators: () => false }), "users")
    await expect((field(strict, "awards") as unknown as typeof join).access.read({})).resolves.toBe(
      false,
    )

    expect(usersConfig.hooks?.afterChange).toHaveLength(2)
    expect(usersConfig.hooks?.afterChange?.[0]).toBe(existingHook)
    expect(usersConfig.hooks?.beforeDelete).toHaveLength(1)
    expect(collection(config, "pages")).toBe(pages)
  })

  it("keeps its schema but does nothing when disabled in code", () => {
    const config = apply({ ...options, disabled: true })
    expect(collection(config, ACHIEVEMENTS_SLUG).endpoints).toEqual([])
    expect(collection(config, ACHIEVEMENTS_SLUG).hooks?.afterChange).toEqual([])
    expect(collection(config, "users")).toBe(users)
  })

  it("offers a beta switch on System → Plugins, off by default", () => {
    const [registered] = registeredPlugins(apply(options))
    expect(registered).toMatchObject({
      slug: "achievements",
      collections: [ACHIEVEMENTS_SLUG, AWARDS_SLUG],
      switch: { label: "Achievements", defaultValue: false },
    })
  })
})

describe("fillOnSave", () => {
  const hook = fillOnSave(resolveAchievementsConfig(options))
  const members = [
    { id: 1, roles: ["member"], createdAt: "2026-10-01" },
    { id: 2, roles: ["member"], createdAt: "2026-10-02" },
  ]
  const run = (
    payload: ReturnType<typeof fakePayload>["payload"],
    doc: object,
    operation: "create" | "update",
    previousDoc?: object,
  ) => hook({ doc, previousDoc, operation, req: { payload } as unknown as PayloadRequest } as never)

  it("awards a new first-members achievement to the members a site has", async () => {
    const { payload, store } = fakePayload({ users: members })
    await run(payload, { id: 5, rule: "firstMembers", limit: 1 }, "create", {})
    expect(store[AWARDS_SLUG]).toEqual([expect.objectContaining({ user: 1, achievement: 5 })])
  })

  it("awards more when the limit is raised, and nothing when it isn't", async () => {
    const { payload, store } = fakePayload({ users: members })
    await run(payload, { id: 5, rule: "firstMembers", limit: 1 }, "update", { limit: 1 })
    expect(store[AWARDS_SLUG]).toEqual([])
    await run(payload, { id: 5, rule: "firstMembers", limit: 2 }, "update", { limit: 1 })
    expect(store[AWARDS_SLUG]).toHaveLength(2)
  })

  it("leaves other rules alone", async () => {
    const { payload } = fakePayload({ users: members })
    await run(payload, { id: 6, rule: "manual" }, "create", {})
    expect(payload.create).not.toHaveBeenCalled()
  })
})

describe("deleteAchievementsAwards", () => {
  it("deletes the achievement's awards, and only those", async () => {
    const { payload, store } = fakePayload({
      rows: [
        { id: 1, user: 1, achievement: 1 },
        { id: 2, user: 1, achievement: 2, revoked: true },
      ],
    })
    await deleteAchievementsAwards({ id: 1, req: { payload } } as never)
    expect(store[AWARDS_SLUG]).toEqual([{ id: 2, user: 1, achievement: 2, revoked: true }])
  })
})

describe("awardChanges", () => {
  const helper = { id: 3, name: "Helper", rule: "manual" }
  const req = (payload: unknown, user?: { id: number }) =>
    ({ user, payload }) as unknown as Parameters<typeof awardChanges>[0]["req"]
  const run = (
    payload: ReturnType<typeof fakePayload>["payload"],
    args: Partial<Parameters<typeof awardChanges>[0]>,
  ) =>
    awardChanges({ context: {}, req: req(payload, { id: 5 }), ...args } as Parameters<
      typeof awardChanges
    >[0])

  it("refuses a row made in the admin that hands out an earned achievement", async () => {
    const { payload } = fakePayload()
    await expect(
      run(payload, { operation: "create", data: { user: 1, achievement: 2 } }),
    ).rejects.toThrow()
    await expect(run(payload, { operation: "create", data: { user: 1 } })).rejects.toThrow()
  })

  it("gives one that's given by hand, stamping when", async () => {
    const { payload, store } = fakePayload()
    store[ACHIEVEMENTS_SLUG]!.push(helper)
    const data = await run(payload, { operation: "create", data: { user: 1, achievement: 3 } })
    expect(data).toMatchObject({ earnedAt: expect.any(String) })
  })

  it("lets the plugin's own award make one", async () => {
    const { payload } = fakePayload()
    const data = { user: 1, achievement: 1 }
    await expect(
      run(payload, { operation: "create", data, context: { [AWARDING]: true } }),
    ).resolves.toEqual(data)
  })

  it("points a moderator at the row a user already has", async () => {
    const { payload } = fakePayload({ rows: [{ id: 1, user: 1, achievement: 1 }] })
    await expect(
      run(payload, {
        operation: "create",
        data: { user: 1, achievement: 1, revoked: true, revokedReason: "Spam" },
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [{ message: expect.stringContaining("already has a row for Early member") }],
      },
    })
  })

  it("stamps who revoked it and when, and clears them when it's given back", async () => {
    const { payload } = fakePayload()
    const created = await run(payload, {
      operation: "create",
      data: { user: 1, achievement: 2, revoked: true, revokedReason: "Spam" },
    })
    expect(created).toMatchObject({ revokedBy: 5, revokedAt: expect.any(String) })
    expect(created).not.toHaveProperty("earnedAt")

    const reinstated = await run(payload, {
      operation: "update",
      originalDoc: { revoked: true },
      data: { revoked: false, revokedReason: "Spam" },
    })
    expect(reinstated).toMatchObject({ revokedAt: null, revokedBy: null, revokedReason: null })

    const anonymous = await awardChanges({
      context: {},
      req: req(payload),
      operation: "update",
      originalDoc: { revoked: false },
      data: { revoked: true },
    } as unknown as Parameters<typeof awardChanges>[0])
    expect(anonymous).toMatchObject({ revokedBy: null })
  })
})
