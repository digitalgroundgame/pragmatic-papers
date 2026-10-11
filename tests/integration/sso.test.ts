import config from "@payload-config"
import { handleEndpoints, type Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { SSO_COOKIE_NAME } from "@/plugins/sso"
import { getSiteURL } from "@/utilities/getURL"
import type { User } from "@/payload-types"
import { createUser, getPayload } from "./helpers/testUsers"

// A whole Discord sign-in against the real database, with Discord itself stubbed: the two
// requests the callback makes (the token exchange and the profile) are answered here.

vi.mock("next/headers", () => ({
  cookies: () => Promise.reject(new Error("no request scope")),
}))

let payload: Payload
const site = getSiteURL()

interface DiscordProfile {
  id: string
  email: string
  verified: boolean
}

function stubDiscord(profile: DiscordProfile) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith("https://discord.com/api/oauth2/token")) {
      return Promise.resolve(
        Response.json({ access_token: "access", token_type: "Bearer", expires_in: 3600 }),
      )
    }
    // Better Auth requests `/users/%40me`.
    if (url.startsWith("https://discord.com/api/users/")) {
      return Promise.resolve(
        Response.json({
          ...profile,
          username: "tester",
          global_name: "Tester",
          discriminator: "0",
          avatar: null,
        }),
      )
    }
    return Promise.reject(new Error(`unexpected request to ${url}`))
  })
}

/** `name=value` pairs from a response's Set-Cookie headers, for the next request. */
function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair?.endsWith("="))
    .join("; ")
}

const api = (path: string, init: RequestInit = {}) =>
  handleEndpoints({
    config,
    request: new Request(`${site}/api${path}`, {
      ...init,
      headers: { Origin: site, ...init.headers },
    }),
  })

/** Starts a sign-in and comes back from Discord as `profile`. */
async function signInWithDiscord(profile: DiscordProfile): Promise<Response> {
  stubDiscord(profile)
  const start = await api("/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "discord",
      callbackURL: "/admin",
      errorCallbackURL: "/admin/login",
    }),
  })
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state")
  return api(`/auth/callback/discord?code=test-code&state=${state}`, {
    headers: { Cookie: cookiesFrom(start) },
  })
}

const me = async (cookie: string): Promise<User | null> => {
  const response = await api("/users/me", { headers: { Cookie: cookie } })
  return ((await response.json()) as { user: User | null }).user
}

const setExperiment = (sso: boolean) =>
  payload.updateGlobal({
    slug: "site-settings",
    data: { experiments: { sso } },
    context: { disableRevalidate: true },
  })

beforeAll(async () => {
  payload = await getPayload()
})

beforeEach(async () => {
  vi.stubEnv("DISCORD_CLIENT_ID", "discord-client")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "discord-secret")
  await setExperiment(true)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("single sign-on", () => {
  it("signs an existing user in to Payload, with their own roles", async () => {
    const editor = await createUser("editor")

    const callback = await signInWithDiscord({ id: "1001", email: editor.email, verified: true })

    expect(callback.status).toBe(302)
    expect(callback.headers.get("location")).toBe("/admin")
    const cookie = cookiesFrom(callback)
    expect(cookie).toContain(`${SSO_COOKIE_NAME}=`)

    const user = await me(cookie)
    expect(user).toMatchObject({ id: editor.id, email: editor.email, roles: ["editor"] })
    expect(user).not.toHaveProperty("hash")
    expect(user).not.toHaveProperty("salt")
  })

  it("Better Auth's own session endpoint returns none of Payload's private columns", async () => {
    const editor = await createUser("editor")
    const cookie = cookiesFrom(
      await signInWithDiscord({ id: "1007", email: editor.email, verified: true }),
    )

    const response = await api("/auth/get-session", { headers: { Cookie: cookie } })
    const { user } = (await response.json()) as { user: Record<string, unknown> }

    expect(Object.keys(user).sort()).toEqual([
      "createdAt",
      "email",
      "emailVerified",
      "id",
      "name",
      "updatedAt",
    ])
  })

  it("signs the same Discord account in again without linking it twice", async () => {
    const writer = await createUser("writer")
    const profile = { id: "1002", email: writer.email, verified: true }

    await signInWithDiscord(profile)
    const second = await signInWithDiscord(profile)

    expect((await me(cookiesFrom(second)))?.id).toBe(writer.id)
    const { pool } = payload.db as unknown as {
      pool: { query: (sql: string) => Promise<{ rows: { n: number }[] }> }
    }
    const accounts = await pool.query(
      `select count(*)::int as n from auth_accounts where user_id = ${writer.id}`,
    )
    expect(accounts.rows[0]?.n).toBe(1)
  })

  it("creates nobody: an address with no account is sent back to the login page", async () => {
    const email = `stranger-${Date.now()}@example.com`

    const callback = await signInWithDiscord({ id: "1003", email, verified: true })

    expect(callback.headers.get("location")).toContain("/admin/login?error=signup_disabled")
    expect(cookiesFrom(callback)).not.toContain(`${SSO_COOKIE_NAME}=`)
    const found = await payload.find({ collection: "users", where: { email: { equals: email } } })
    expect(found.totalDocs).toBe(0)
  })

  it("refuses an address the provider hasn't verified", async () => {
    const admin = await createUser("admin")

    const callback = await signInWithDiscord({ id: "1004", email: admin.email, verified: false })

    expect(callback.headers.get("location")).toContain("error=")
    expect(cookiesFrom(callback)).not.toContain(`${SSO_COOKIE_NAME}=`)
  })

  it("logging out of Payload ends the session", async () => {
    const editor = await createUser("editor")
    const cookie = cookiesFrom(
      await signInWithDiscord({ id: "1005", email: editor.email, verified: true }),
    )
    expect((await me(cookie))?.id).toBe(editor.id)

    const logout = await api("/users/logout", { method: "POST", headers: { Cookie: cookie } })

    expect(logout.status).toBe(200)
    expect(await me(cookie)).toBeNull()
  })

  it("is switched off with the experiment: no endpoints, and old sessions are ignored", async () => {
    const editor = await createUser("editor")
    const cookie = cookiesFrom(
      await signInWithDiscord({ id: "1006", email: editor.email, verified: true }),
    )

    await setExperiment(false)

    expect(await me(cookie)).toBeNull()
    const start = await api("/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "discord" }),
    })
    expect(start.status).toBe(404)
  })

  it("keeps Better Auth away from the users table", async () => {
    for (const path of ["/sign-up/email", "/sign-in/email", "/update-user", "/delete-user"]) {
      const response = await api(`/auth${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@example.com", password: "password1234", name: "A" }),
      })
      expect(response.status, path).toBe(404)
    }
  })
})
