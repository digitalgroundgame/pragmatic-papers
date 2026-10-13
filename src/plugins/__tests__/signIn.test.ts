import type { Payload } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { commentsOn, signUpProviders, ssoOptions } from "../signIn"

const payloadWith = (switches: Record<string, boolean>) =>
  ({
    findGlobal: vi.fn(async ({ slug }: { slug: string }) =>
      slug === "plugins" ? { switches } : {},
    ),
    update: vi.fn(),
  }) as unknown as Payload & { update: ReturnType<typeof vi.fn> }

afterEach(() => vi.unstubAllEnvs())

describe("ssoOptions", () => {
  it("follows the sso switch on System → Plugins, read fresh each time", async () => {
    const { enabled } = ssoOptions
    if (typeof enabled !== "function") throw new Error("enabled should read the switch")
    expect(await enabled(payloadWith({ sso: true }))).toBe(true)
    expect(await enabled(payloadWith({ sso: false }))).toBe(false)
  })

  it("makes only staff Payload's user", () => {
    expect(ssoOptions.isPayloadUser?.({ roles: ["editor"] })).toBe(true)
    expect(ssoOptions.isPayloadUser?.({ roles: ["member"] })).toBe(false)
  })

  it("opens sign-ups with comments", async () => {
    const { signUp } = ssoOptions
    expect(await signUp?.enabled({ payload: payloadWith({ comments: true, sso: true }) })).toBe(
      true,
    )
    expect(await signUp?.enabled({ payload: payloadWith({ comments: false, sso: true }) })).toBe(
      false,
    )
  })

  it("gives each new member a random slug", () => {
    const first = ssoOptions.signUp?.columns?.()
    expect(first).toEqual({ slug: expect.stringMatching(/^member-[0-9a-f]{12}$/) })
    expect(ssoOptions.signUp?.columns?.()).not.toEqual(first)
  })

  it("makes a new user a member, keeping the random slug", async () => {
    const payload = payloadWith({})
    await ssoOptions.signUp?.afterCreate?.({ payload, userId: "12" })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        id: 12,
        data: { roles: ["member"], generateSlug: false },
        overrideAccess: true,
      }),
    )
  })
})

describe("commentsOn", () => {
  it("needs single sign-on on too, since readers have no other way to sign in", async () => {
    expect(await commentsOn(payloadWith({ comments: true, sso: true }))).toBe(true)
    expect(await commentsOn(payloadWith({ comments: true, sso: false }))).toBe(false)
    expect(await commentsOn(payloadWith({ comments: false, sso: true }))).toBe(false)
  })
})

describe("signUpProviders", () => {
  it("lists the providers with credentials, Destiny.gg included", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "")
    vi.stubEnv("DISCORD_CLIENT_ID", "d")
    vi.stubEnv("DISCORD_CLIENT_SECRET", "d")
    vi.stubEnv("DESTINY_CLIENT_ID", "g")
    vi.stubEnv("DESTINY_CLIENT_SECRET", "g")

    expect(signUpProviders()).toEqual([
      { id: "discord", label: "Discord" },
      { id: "destiny", label: "Destiny.gg" },
    ])
  })
})
