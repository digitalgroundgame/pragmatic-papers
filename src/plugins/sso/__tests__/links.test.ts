import type { Payload, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as authModule from "../auth"
import { getAuth } from "../auth"
import { linkEndpoints } from "../endpoints/links"
import type { ResolvedSsoConfig } from "../types"

vi.mock("../auth", async (importOriginal) => ({
  ...(await importOriginal<typeof authModule>()),
  getAuth: vi.fn(),
}))

const query = vi.fn()
const linkForUser = vi.fn()
const getSession = vi.fn()
const enabled = vi.fn()

const config = {
  enabled,
  usersSlug: "users",
  cookieName: "pp-session",
  accountPath: "/account",
  // Staff: Payload's own user, whose links come back to the admin.
  isPayloadUser: () => true,
  providers: () => ({
    discord: { clientId: "d", clientSecret: "d" },
    destiny: { clientId: "g", clientSecret: "g" },
    google: undefined,
  }),
} as unknown as ResolvedSsoConfig

const payload = {
  db: { pool: { query } },
  config: { routes: { admin: "/admin" } },
} as unknown as Payload

const [list, connect, disconnect] = linkEndpoints(config)
const headers = new Headers({ cookie: "payload-token=abc" })

const signedIn = { id: 7, email: "someone@example.com", collection: "users" }

const call = (
  endpoint: typeof list,
  { user = signedIn as unknown, provider }: { user?: unknown; provider?: string } = {},
) =>
  endpoint!.handler({
    payload,
    user,
    headers,
    routeParams: provider === undefined ? {} : { provider },
  } as unknown as PayloadRequest)

beforeEach(() => {
  vi.clearAllMocks()
  enabled.mockResolvedValue(true)
  vi.mocked(getAuth).mockResolvedValue({ api: { linkForUser, getSession } } as never)
})

describe("linkEndpoints", () => {
  it("serves the list, connect and disconnect under /auth-links", () => {
    expect(linkEndpoints(config).map(({ method, path }) => [method, path])).toEqual([
      ["get", "/auth-links"],
      ["post", "/auth-links/:provider"],
      ["delete", "/auth-links/:provider"],
    ])
  })

  it("answers 404 while single sign-on is off", async () => {
    enabled.mockResolvedValue(false)
    for (const [endpoint, provider] of [
      [list],
      [connect, "discord"],
      [disconnect, "discord"],
    ] as const) {
      expect((await call(endpoint, { provider })).status).toBe(404)
    }
    expect(query).not.toHaveBeenCalled()
  })

  it("answers 401 without a signed-in user, or for someone outside the users collection", async () => {
    expect((await call(list, { user: null })).status).toBe(401)
    expect((await call(list, { user: { ...signedIn, collection: "readers" } })).status).toBe(401)
  })

  it("answers 404 for a provider that isn't configured", async () => {
    expect((await call(connect, { provider: "google" })).status).toBe(404)
    expect((await call(disconnect, { provider: "github" })).status).toBe(404)
  })

  it("lists each configured provider and whether this user has linked it", async () => {
    query.mockResolvedValue({ rows: [{ provider_id: "destiny" }] })

    const response = await call(list)

    expect(await response.json()).toEqual({
      providers: [
        { id: "discord", label: "Discord", linked: false },
        { id: "destiny", label: "Destiny.gg", linked: true },
      ],
    })
    expect(query).toHaveBeenCalledWith(expect.stringContaining("where user_id = $1"), ["7"])
  })

  it("starts a link for the signed-in user, back to their account page", async () => {
    const started = Response.json({ url: "https://www.destiny.gg/oauth/authorize" })
    linkForUser.mockResolvedValue(started)

    const response = await call(connect, { provider: "destiny" })

    expect(response).toBe(started)
    expect(linkForUser).toHaveBeenCalledWith({
      body: {
        provider: "destiny",
        userId: "7",
        email: "someone@example.com",
        callbackURL: "/admin/account?linked=destiny",
        errorCallbackURL: "/admin/account",
      },
      headers,
      asResponse: true,
    })
  })

  it("disconnects the provider and ends the user's other SSO sessions", async () => {
    query.mockResolvedValue({ rows: [] })
    getSession.mockResolvedValue({ session: { id: "current" } })

    const response = await call(disconnect, { provider: "discord" })

    expect(await response.json()).toEqual({ ok: true })
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('delete from "auth_accounts"'),
      ["7", "discord"],
    )
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('delete from "auth_sessions"'),
      ["7", "current"],
    )
  })

  it("ends every SSO session when the request has none of its own", async () => {
    query.mockResolvedValue({ rows: [] })
    getSession.mockRejectedValue(new Error("no session"))

    await call(disconnect, { provider: "discord" })

    expect(query).toHaveBeenLastCalledWith(expect.any(String), ["7", ""])
  })
})
