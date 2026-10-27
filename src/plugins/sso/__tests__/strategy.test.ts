import type { Payload } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuth } from "../auth"
import { hasSessionCookie, ssoStrategy } from "../strategy"
import type { ResolvedSsoConfig } from "../types"

vi.mock("../auth", () => ({ getAuth: vi.fn() }))

const getSession = vi.fn()
const findByID = vi.fn()
const enabled = vi.fn()
const logger = { error: vi.fn() }

const config = {
  enabled,
  cookieName: "pp-session",
  usersSlug: "users",
  isPayloadUser: (user: Record<string, unknown>) => (user.roles as string[]).includes("editor"),
} as unknown as ResolvedSsoConfig

const payload = { findByID, logger, db: { defaultIDType: "number" } } as unknown as Payload

const authenticate = (cookie?: string) =>
  ssoStrategy(config).authenticate({
    payload,
    headers: new Headers(cookie ? { cookie } : {}),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuth).mockResolvedValue({ api: { getSession } } as never)
  enabled.mockResolvedValue(true)
})

describe("hasSessionCookie", () => {
  it.each([
    ["pp-session=abc", true],
    ["theme=dark; pp-session=abc", true],
    ["payload-token=abc", false],
    ["not-pp-session=abc", false],
    ["", false],
  ])("%j → %s", (cookie, expected) => {
    expect(hasSessionCookie(new Headers({ cookie }), "pp-session")).toBe(expected)
  })
})

describe("ssoStrategy", () => {
  it("answers a request without the cookie without asking anything", async () => {
    expect(await authenticate("payload-token=abc")).toEqual({ user: null })
    expect(enabled).not.toHaveBeenCalled()
    expect(getSession).not.toHaveBeenCalled()
  })

  it("ignores the cookie while single sign-on is switched off", async () => {
    enabled.mockResolvedValue(false)
    expect(await authenticate("pp-session=abc")).toEqual({ user: null })
    expect(getSession).not.toHaveBeenCalled()
  })

  it("returns the session's Payload user, read without refreshing the session", async () => {
    getSession.mockResolvedValue({ user: { id: "7" }, session: {} })
    findByID.mockResolvedValue({ id: 7, email: "editor@example.com", roles: ["editor"] })

    const result = await authenticate("pp-session=abc")

    expect(getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableRefresh: true } }),
    )
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: "users", id: 7 }))
    expect(result.user).toMatchObject({ id: 7, collection: "users", _strategy: "sso" })
  })

  it("leaves a member anonymous to Payload", async () => {
    getSession.mockResolvedValue({ user: { id: "8" }, session: {} })
    findByID.mockResolvedValue({ id: 8, email: "member@example.com", roles: ["member"] })
    expect(await authenticate("pp-session=abc")).toEqual({ user: null })
  })

  it.each([
    ["the session has expired", null, { id: 7 }],
    ["the user has been deleted", { user: { id: "7" } }, null],
  ])("signs nobody in when %s", async (_name, session, user) => {
    getSession.mockResolvedValue(session)
    findByID.mockResolvedValue(user)
    expect(await authenticate("pp-session=abc")).toEqual({ user: null })
  })

  it("signs nobody in, and logs, when the session can't be read", async () => {
    getSession.mockRejectedValue(new Error("database is down"))
    expect(await authenticate("pp-session=abc")).toEqual({ user: null })
    expect(logger.error).toHaveBeenCalled()
  })
})
