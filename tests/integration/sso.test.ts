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

interface DestinyggProfile {
  userId: number
  username: string
}

function stubDestinygg(profile: DestinyggProfile) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith("https://www.destiny.gg/oauth/token")) {
      return Promise.resolve(
        Response.json({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          scope: "identify",
          token_type: "bearer",
        }),
      )
    }
    if (url.startsWith("https://www.destiny.gg/api/userinfo")) {
      return Promise.resolve(
        Response.json({ ...profile, nick: profile.username, roles: ["USER"], features: [] }),
      )
    }
    return Promise.reject(new Error(`unexpected request to ${url}`))
  })
}

/** Starts a sign-in and comes back from Destiny.gg as `profile`. */
async function signInWithDestinygg(profile: DestinyggProfile): Promise<Response> {
  stubDestinygg(profile)
  const start = await api("/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "destinygg",
      callbackURL: "/admin",
      errorCallbackURL: "/admin/login",
    }),
  })
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  expect(url).toContain("https://www.destiny.gg/oauth/authorize?")
  const state = new URL(url).searchParams.get("state")
  return api(`/auth/callback/destinygg?code=test-code&state=${state}`, {
    headers: { Cookie: cookiesFrom(start) },
  })
}

/** Payload's own cookie for `user`, from a password login. */
async function passwordLogin(user: User): Promise<string> {
  const response = await api("/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: "test-password" }),
  })
  expect(response.status).toBe(200)
  return cookiesFrom(response)
}

/**
 * Links a provider account from the signed-in user's account page: Connect, then back
 * from the provider. `stub` answers the provider's requests as the account being linked.
 */
async function link(cookie: string, provider: string, stub: () => void): Promise<Response> {
  stub()
  const start = await api(`/auth-links/${provider}`, {
    method: "POST",
    headers: { Cookie: cookie },
  })
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state")
  return api(`/auth/callback/${provider}?code=test-code&state=${state}`, {
    headers: { Cookie: cookiesFrom(start) },
  })
}

const linkedProviders = async (cookie: string) => {
  const response = await api("/auth-links", { headers: { Cookie: cookie } })
  const { providers } = (await response.json()) as { providers: { id: string; linked: boolean }[] }
  return Object.fromEntries(providers.map(({ id, linked }) => [id, linked]))
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
  vi.stubEnv("DESTINYGG_CLIENT_ID", "dgg-client")
  vi.stubEnv("DESTINYGG_CLIENT_SECRET", "dgg-secret")
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
      "image",
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

describe("linking an account from the account page", () => {
  let nextId = 5000
  const destinygg = (username = `Someone${nextId}`) => ({ userId: nextId++, username })

  it("links Destiny.gg, which shares no address, and then signs in with it", async () => {
    const editor = await createUser("editor")
    const profile = destinygg()

    const linked = await link(await passwordLogin(editor), "destinygg", () =>
      stubDestinygg(profile),
    )

    expect(linked.headers.get("location")).toBe("/admin/account?linked=destinygg")
    const callback = await signInWithDestinygg(profile)
    expect(callback.headers.get("location")).toBe("/admin")
    expect(await me(cookiesFrom(callback))).toMatchObject({ id: editor.id, roles: ["editor"] })
  })

  it("follows a linked Destiny.gg account after a rename", async () => {
    const writer = await createUser("writer")
    const profile = destinygg()
    await link(await passwordLogin(writer), "destinygg", () => stubDestinygg(profile))

    const renamed = await signInWithDestinygg({ ...profile, username: "SomethingNew" })

    expect((await me(cookiesFrom(renamed)))?.id).toBe(writer.id)
  })

  it("sends a Destiny.gg account nobody linked back to the login page, creating nobody", async () => {
    const before = await payload.count({ collection: "users" })

    const callback = await signInWithDestinygg(destinygg("Stranger"))

    expect(callback.headers.get("location")).toContain("/admin/login?error=email_not_found")
    expect(cookiesFrom(callback)).not.toContain(`${SSO_COOKIE_NAME}=`)
    expect((await payload.count({ collection: "users" })).totalDocs).toBe(before.totalDocs)
  })

  it("links a Discord account whose address isn't the user's", async () => {
    const writer = await createUser("writer")
    const profile = { id: `${nextId++}`, email: `other-${nextId}@example.com`, verified: true }

    await link(await passwordLogin(writer), "discord", () => stubDiscord(profile))

    expect((await me(cookiesFrom(await signInWithDiscord(profile))))?.id).toBe(writer.id)
  })

  it("won't link an account that's someone else's", async () => {
    const [first, second] = [await createUser("writer"), await createUser("writer")]
    const profile = destinygg()
    await link(await passwordLogin(first), "destinygg", () => stubDestinygg(profile))

    const callback = await link(await passwordLogin(second), "destinygg", () =>
      stubDestinygg(profile),
    )

    expect(callback.headers.get("location")).toContain(
      "error=account_already_linked_to_different_user",
    )
    expect((await me(cookiesFrom(await signInWithDestinygg(profile))))?.id).toBe(first.id)
  })

  it("lists the configured providers and which are linked", async () => {
    const editor = await createUser("editor")
    const cookie = await passwordLogin(editor)
    await link(cookie, "destinygg", () => stubDestinygg(destinygg()))

    expect(await linkedProviders(cookie)).toEqual({ discord: false, destinygg: true })
  })

  it("disconnects an account, ending the sessions it signed in", async () => {
    const editor = await createUser("editor")
    const cookie = await passwordLogin(editor)
    const profile = destinygg()
    await link(cookie, "destinygg", () => stubDestinygg(profile))
    const ssoCookie = cookiesFrom(await signInWithDestinygg(profile))
    expect((await me(ssoCookie))?.id).toBe(editor.id)

    const response = await api("/auth-links/destinygg", {
      method: "DELETE",
      headers: { Cookie: cookie },
    })

    expect(response.status).toBe(200)
    expect(await linkedProviders(cookie)).toEqual({ discord: false, destinygg: false })
    expect(await me(ssoCookie)).toBeNull()
    expect(await me(cookie)).toMatchObject({ id: editor.id })
    const again = await signInWithDestinygg(profile)
    expect(again.headers.get("location")).toContain("error=email_not_found")
  })

  it("answers only a signed-in user, and only while the experiment is on", async () => {
    expect((await api("/auth-links")).status).toBe(401)
    expect((await api("/auth-links/destinygg", { method: "POST" })).status).toBe(401)

    const cookie = await passwordLogin(await createUser("editor"))
    expect(
      (await api("/auth-links/google", { method: "POST", headers: { Cookie: cookie } })).status,
    ).toBe(404)

    await setExperiment(false)
    expect((await api("/auth-links", { headers: { Cookie: cookie } })).status).toBe(404)
  })

  it("has no HTTP route to the link it starts for a user", async () => {
    const response = await api("/auth/link-for-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "destinygg", userId: "1", email: "a@example.com" }),
    })
    expect(response.status).toBe(404)
  })
})
