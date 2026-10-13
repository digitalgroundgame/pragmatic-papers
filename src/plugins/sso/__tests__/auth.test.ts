import type { BetterAuthOptions } from "better-auth"
import type { Payload } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { configuredProviders, destinyEmail, getAuth } from "../auth"
import type { ResolvedSsoConfig } from "../types"

const betterAuth = vi.fn((options: BetterAuthOptions) => ({ options }))
vi.mock("better-auth", () => ({ betterAuth }))

const google = { clientId: "google-id", clientSecret: "google-secret" }
const discord = { clientId: "discord-id", clientSecret: "discord-secret" }
const destiny = { clientId: "dgg-id", clientSecret: "dgg-secret" }

const config = (overrides: Partial<ResolvedSsoConfig> = {}): ResolvedSsoConfig => ({
  enabled: () => true,
  providers: () => ({ google, discord }),
  baseURL: () => "https://example.com",
  secret: () => "secret",
  usersSlug: "users",
  cookieName: "pp-session",
  payloadUserCookie: "payload-token-sso",
  isPayloadUser: () => true,
  accountPath: "/account",
  sessionSeconds: 3600,
  requiredUserColumns: [],
  ...overrides,
})

const pool = { query: vi.fn() }
const newPayload = () =>
  ({ db: { pool }, config: { routes: { api: "/api" } } }) as unknown as Payload

/** A user as Better Auth hands it to the create hooks. */
const newUser = (overrides: Record<string, unknown> = {}) =>
  ({ id: "9", name: "Ada", email: "ada@example.com", emailVerified: true, ...overrides }) as never

/** The options `getAuth` handed Better Auth for a fresh Payload instance. */
async function optionsFor(sso: ResolvedSsoConfig): Promise<BetterAuthOptions> {
  const auth = (await getAuth(newPayload(), sso)) as unknown as { options: BetterAuthOptions }
  return auth.options
}

beforeEach(() => {
  betterAuth.mockClear()
})

describe("getAuth", () => {
  it("creates one Better Auth per Payload instance", async () => {
    const payload = newPayload()
    const first = await getAuth(payload, config())
    const second = await getAuth(payload, config())
    await getAuth(newPayload(), config())

    expect(second).toBe(first)
    expect(betterAuth).toHaveBeenCalledTimes(2)
  })

  it("runs on Payload's own pool, under Payload's API route", async () => {
    const options = await optionsFor(config())
    expect(options.database).toBe(pool)
    expect(options.basePath).toBe("/api/auth")
    expect(options.baseURL).toBe("https://example.com")
    expect(options.secret).toBe("secret")
    expect(options.telemetry).toEqual({ enabled: false })
  })

  it("offers only the providers with credentials, none of them allowing sign-up", async () => {
    const options = await optionsFor(config({ providers: () => ({ google, discord: null }) }))
    expect(options.socialProviders).toEqual({ google: { ...google, disableSignUp: true } })
  })

  it("refuses to create a user however it's asked, without sign-up", async () => {
    const options = await optionsFor(config())
    expect(await options.databaseHooks?.user?.create?.before?.(newUser(), null)).toBe(false)
    expect(options.disabledPaths).toEqual(
      expect.arrayContaining(["/sign-up/email", "/update-user", "/delete-user"]),
    )
  })

  describe("with sign-up", () => {
    const enabled = vi.fn()
    const afterCreate = vi.fn()
    const signUp = { enabled, afterCreate, columns: () => ({ slug: "member-abc" }) }

    beforeEach(() => {
      enabled.mockReset().mockResolvedValue(true)
      afterCreate.mockReset()
    })

    it("lets a provider create a user only when the sign-in asks to", async () => {
      const options = await optionsFor(config({ providers: () => ({ google }), signUp }))
      expect(options.socialProviders).toEqual({
        google: { ...google, disableImplicitSignUp: true },
      })
    })

    it("writes the required columns in the same insert", async () => {
      const options = await optionsFor(config({ signUp }))
      expect(await options.databaseHooks?.user?.create?.before?.(newUser(), null)).toEqual({
        data: expect.objectContaining({ email: "ada@example.com", slug: "member-abc" }),
      })
    })

    it("refuses while sign-ups are closed", async () => {
      enabled.mockResolvedValue(false)
      const options = await optionsFor(config({ signUp }))
      expect(await options.databaseHooks?.user?.create?.before?.(newUser(), null)).toBe(false)
    })

    it("refuses an address the provider hasn't verified", async () => {
      const options = await optionsFor(config({ signUp }))
      const before = options.databaseHooks?.user?.create?.before
      expect(await before?.(newUser({ emailVerified: false }), null)).toBe(false)
      expect(enabled).not.toHaveBeenCalled()
    })

    it("hands the new user to Payload to finish", async () => {
      const options = await optionsFor(config({ signUp }))
      await options.databaseHooks?.user?.create?.after?.(newUser(), null)
      expect(afterCreate).toHaveBeenCalledWith({ payload: expect.anything(), userId: "9" })
    })
  })

  it("reads the users collection, and names its required columns without returning them", async () => {
    const options = await optionsFor(config({ usersSlug: "staff", requiredUserColumns: ["slug"] }))
    expect(options.user?.modelName).toBe("staff")
    expect(options.user?.additionalFields).toEqual({
      slug: { type: "string", required: false, input: false, returned: false },
    })
  })

  it("keeps sessions for the configured time, in the configured cookie", async () => {
    const options = await optionsFor(config({ sessionSeconds: 60, cookieName: "sso" }))
    expect(options.session?.expiresIn).toBe(60)
    expect(options.advanced?.cookies).toEqual({ session_token: { name: "sso" } })
    expect(options.advanced?.useSecureCookies).toBe(false)
  })

  it.each([
    ["https://example.com", true],
    ["http://localhost:8000", false],
  ])("marks the cookie Secure for %s: %s", async (baseURL, secure) => {
    const options = await optionsFor(config({ baseURL: () => baseURL }))
    expect(options.advanced?.defaultCookieAttributes).toEqual({ secure })
  })

  it("links a provider login to an existing user, and generates serial ids", async () => {
    const options = await optionsFor(config())
    expect(options.account?.accountLinking).toEqual({
      enabled: true,
      requireLocalEmailVerified: false,
      trustedProviders: ["destiny"],
      allowDifferentEmails: true,
    })
    expect(options.account?.encryptOAuthTokens).toBe(true)
    expect(options.advanced?.database).toEqual({ generateId: "serial" })
  })

  it("registers Destiny.gg through a plugin, not as a built-in provider", async () => {
    const options = await optionsFor(config({ providers: () => ({ google, destiny }) }))
    expect(Object.keys(options.socialProviders ?? {})).toEqual(["google"])
    expect(options.plugins?.map(({ id }) => id)).toEqual([
      "payload-linking",
      "payload-user-cookie",
      "destiny",
    ])
  })

  it("registers no Destiny.gg plugin without its credentials", async () => {
    const options = await optionsFor(config({ providers: () => ({ google, destiny: null }) }))
    expect(options.plugins?.map(({ id }) => id)).toEqual(["payload-linking", "payload-user-cookie"])
  })
})

describe("destinyEmail", () => {
  const profile = { userId: 42, username: "Someone" }

  it("is the address of the user the account is linked to, by its Destiny.gg id", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ email: "linked@example.com" }] })
    expect(await destinyEmail({ query } as never, "users", profile)).toBe("linked@example.com")
    expect(query.mock.calls[0]?.[1]).toEqual(["42"])
  })

  it("is null for an account nobody has linked", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })
    expect(await destinyEmail({ query } as never, "users", profile)).toBeNull()
  })
})

describe("configuredProviders", () => {
  it("lists the providers with credentials, in the config's order", () => {
    expect(configuredProviders(config({ providers: () => ({ discord, google }) }))).toEqual([
      "discord",
      "google",
    ])
    expect(configuredProviders(config({ providers: () => ({ google: null, discord }) }))).toEqual([
      "discord",
    ])
    expect(configuredProviders(config({ providers: () => ({}) }))).toEqual([])
  })
})
