import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { accountEndpoints, MAX_NAME_LENGTH, normalizeName } from "../endpoints/account"
import { getSignedInUser } from "../session"
import type { ResolvedSsoConfig } from "../types"

vi.mock("../session", () => ({ getSignedInUser: vi.fn() }))

describe("normalizeName", () => {
  it("collapses spaces and drops control characters", () => {
    expect(normalizeName("  Ada \t  Lovelace\u0007 ")).toEqual({ ok: true, name: "Ada Lovelace" })
  })

  it.each([[undefined], [42], [""], ["   "]])("refuses %j", (raw) => {
    expect(normalizeName(raw)).toEqual({ ok: false, message: "Enter a name." })
  })

  it("refuses a name that's too long", () => {
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH + 1))).toMatchObject({ ok: false })
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH))).toMatchObject({ ok: true })
  })
})

describe("accountEndpoints", () => {
  const site = "https://example.com"
  const member = { id: 7, name: "Ada", email: "ada@example.com", roles: ["member"] }
  const signedIn = vi.fn()
  const enabled = vi.fn()
  const payload = { update: vi.fn(), delete: vi.fn() }

  const config = {
    enabled,
    baseURL: () => site,
    usersSlug: "users",
    cookieName: "pp-session",
    payloadUserCookie: "payload-token-sso",
    isPayloadUser: (user: { roles?: string[] }) => !user.roles?.includes("member"),
  } as unknown as ResolvedSsoConfig

  const [get, patch, remove] = accountEndpoints(config)

  const call = (
    endpoint: typeof get,
    { body, origin = site }: { body?: unknown; origin?: string | null } = {},
  ) =>
    endpoint!.handler({
      payload,
      headers: new Headers(origin ? { origin } : {}),
      json: async () => body,
    } as unknown as PayloadRequest)

  beforeEach(() => {
    vi.clearAllMocks()
    enabled.mockResolvedValue(true)
    signedIn.mockResolvedValue(member)
    vi.mocked(getSignedInUser).mockImplementation(signedIn)
  })

  it("serves GET, PATCH and DELETE on /account", () => {
    expect(accountEndpoints(config).map(({ method, path }) => `${method} ${path}`)).toEqual([
      "get /account",
      "patch /account",
      "delete /account",
    ])
  })

  it("answers 404 while single sign-on is off, and 401 to nobody", async () => {
    enabled.mockResolvedValue(false)
    expect((await call(get)).status).toBe(404)
    enabled.mockResolvedValue(true)
    signedIn.mockResolvedValue(null)
    expect((await call(get)).status).toBe(401)
    expect((await call(patch, { body: { name: "X" } })).status).toBe(401)
    expect((await call(remove)).status).toBe(401)
  })

  it("describes the account, hiding a placeholder address", async () => {
    expect(await (await call(get)).json()).toEqual({
      name: "Ada",
      email: "ada@example.com",
      managedInAdmin: false,
    })
    signedIn.mockResolvedValue({ ...member, email: "destiny-1@no-email.invalid", name: 3 })
    expect(await (await call(get)).json()).toEqual({ name: "", email: null, managedInAdmin: false })
  })

  it("renames from the site only, refusing a bad name", async () => {
    payload.update.mockResolvedValue({ ...member, name: "Ada L." })

    const renamed = await call(patch, { body: { name: " Ada  L. " } })
    expect(renamed.status).toBe(200)
    expect(((await renamed.json()) as { name: string }).name).toBe("Ada L.")
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "users", id: 7, data: { name: "Ada L." } }),
    )

    expect((await call(patch, { body: { name: "" } })).status).toBe(400)
    expect((await call(patch, { body: { name: "X" }, origin: "https://evil.test" })).status).toBe(
      403,
    )
    expect((await call(patch, { body: { name: "X" }, origin: null })).status).toBe(403)
    expect(payload.update).toHaveBeenCalledTimes(1)
  })

  it("deletes a member's account and clears both cookies", async () => {
    const response = await call(remove)

    expect(response.status).toBe(200)
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "users", id: 7 }),
    )
    const cookies = response.headers.getSetCookie()
    expect(cookies).toEqual([
      expect.stringMatching(/^pp-session=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax; Secure$/),
      expect.stringMatching(/^payload-token-sso=;/),
    ])
  })

  it("leaves staff accounts, and cross-site requests, alone", async () => {
    signedIn.mockResolvedValue({ ...member, roles: ["editor"] })
    expect((await call(remove)).status).toBe(403)
    signedIn.mockResolvedValue(member)
    expect((await call(remove, { origin: "https://evil.test" })).status).toBe(403)
    expect(payload.delete).not.toHaveBeenCalled()
  })
})
