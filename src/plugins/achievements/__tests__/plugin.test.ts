import type { CollectionConfig, Config } from "payload"
import { describe, expect, it, vi } from "vitest"

import { achievementsPlugin, type AchievementsPluginConfig } from ".."
import { revocations } from "../collection"
import { ACHIEVEMENTS_SLUG, AWARDING } from "../constants"
import { registeredPlugins } from "@/utilities/registerPlugin"

const moderators = () => true
const admins = () => false
const options: AchievementsPluginConfig = {
  currentUser: async () => null,
  isMember: () => true,
  moderators,
  admins,
}

const existingHook = () => undefined
const users: CollectionConfig = {
  slug: "users",
  auth: true,
  fields: [],
  hooks: { afterChange: [existingHook] },
}
const pages: CollectionConfig = { slug: "pages", fields: [] }

const apply = (pluginOptions: AchievementsPluginConfig) =>
  achievementsPlugin(pluginOptions)({ collections: [users, pages] } as Config) as Config
const collection = (config: Config, slug: string) =>
  config.collections!.find((c) => c.slug === slug)!

describe("achievementsPlugin", () => {
  it("adds the achievements collection, for moderators, with only admins deleting rows", () => {
    const config = apply(options)
    const achievements = collection(config, ACHIEVEMENTS_SLUG)

    expect(config.collections!.map(({ slug }) => slug)).toEqual(["users", "pages", "achievements"])
    expect(achievements.admin?.group).toBe("Content")
    expect(achievements.labels).toEqual({ singular: "Achievement", plural: "Achievements" })
    expect(achievements.access).toMatchObject({
      read: moderators,
      create: moderators,
      update: moderators,
      delete: admins,
    })
    expect(achievements.indexes).toEqual([{ fields: ["user", "achievement"], unique: true }])
    expect(achievements.endpoints).toHaveLength(1)
  })

  it("awards on the users collection after its own hooks, and cleans up when one is deleted", () => {
    const config = apply(options)
    expect(collection(config, "users").hooks?.afterChange).toHaveLength(2)
    expect(collection(config, "users").hooks?.afterChange?.[0]).toBe(existingHook)
    expect(collection(config, "users").hooks?.beforeDelete).toHaveLength(1)
    expect(collection(config, "pages")).toBe(pages)
  })

  it("keeps its schema but does nothing when disabled in code", () => {
    const config = apply({ ...options, disabled: true })
    expect(collection(config, ACHIEVEMENTS_SLUG).endpoints).toEqual([])
    expect(collection(config, "users")).toBe(users)
  })

  it("offers a beta switch on System → Plugins, off by default", () => {
    const [registered] = registeredPlugins(apply(options))
    expect(registered).toMatchObject({
      slug: "achievements",
      collections: [ACHIEVEMENTS_SLUG],
      switch: { label: "Achievements", defaultValue: false },
    })
  })
})

describe("revocations", () => {
  const count = vi.fn()
  const req = (user?: { id: number }) =>
    ({ user, payload: { count } }) as unknown as Parameters<typeof revocations>[0]["req"]
  const run = (args: Partial<Parameters<typeof revocations>[0]>) =>
    revocations({ context: {}, req: req({ id: 5 }), ...args } as Parameters<typeof revocations>[0])

  it("refuses a row made in the admin that doesn't revoke", async () => {
    count.mockResolvedValue({ totalDocs: 0 })
    await expect(
      run({ operation: "create", data: { user: 1, achievement: "verified" } }),
    ).rejects.toThrow()
  })

  it("lets the plugin's own award make one", async () => {
    const data = { user: 1, achievement: "early-member" }
    await expect(
      run({ operation: "create", data, context: { [AWARDING]: true } }),
    ).resolves.toEqual(data)
  })

  it("points a moderator at the row an account already has", async () => {
    count.mockResolvedValue({ totalDocs: 1 })
    await expect(
      run({ operation: "create", data: { user: 1, achievement: "early-member", revoked: true } }),
    ).rejects.toThrow()
  })

  it("stamps who revoked it and when, and clears them when it's given back", async () => {
    count.mockResolvedValue({ totalDocs: 0 })
    const created = await run({
      operation: "create",
      data: { user: 1, achievement: "verified", revoked: true, revokedReason: "Spam" },
    })
    expect(created).toMatchObject({ revokedBy: 5, revokedAt: expect.any(String) })

    const reinstated = await run({
      operation: "update",
      originalDoc: { revoked: true },
      data: { revoked: false, revokedReason: "Spam" },
    })
    expect(reinstated).toMatchObject({ revokedAt: null, revokedBy: null, revokedReason: null })
  })
})
