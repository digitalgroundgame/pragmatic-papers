import type { Payload } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuth } from "../auth"
import { isAllowedOrigin } from "../session"
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

const SITE = "https://pragmaticpapers.com"

const payload = {
  findByID,
  logger,
  db: { defaultIDType: "number" },
  config: { csrf: [SITE] },
} as unknown as Payload

/** A browser's same-origin request, unless `extra` says otherwise. */
const authenticate = (cookie?: string, extra: Record<string, string> = { origin: SITE }) =>
  ssoStrategy(config).authenticate({
    payload,
    headers: new Headers({ ...(cookie ? { cookie } : {}), ...extra }),
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

describe("isAllowedOrigin", () => {
  const allowed = (headers: Record<string, string>, list = [SITE]) =>
    isAllowedOrigin(new Headers(headers), list)

  it("allows the site's own origin and refuses any other", () => {
    expect(allowed({ origin: SITE })).toBe(true)
    expect(allowed({ origin: "https://pr-12.pragmaticpapers.com" })).toBe(false)
    expect(allowed({ origin: "https://staging.pragmaticpapers.com" })).toBe(false)
    expect(allowed({ origin: "null" })).toBe(false)
  })

  it("goes by the Origin when there is one, whatever Sec-Fetch-Site says", () => {
    expect(
      allowed({ origin: "https://pr-12.pragmaticpapers.com", "sec-fetch-site": "same-site" }),
    ).toBe(false)
  })

  it.each([
    ["same-origin", true],
    ["same-site", true],
    ["none", true],
    ["cross-site", false],
  ])("without an Origin, Sec-Fetch-Site %s → %s", (site, expected) => {
    expect(allowed({ "sec-fetch-site": site })).toBe(expected)
  })

  it("allows a cross-site page load, as a provider's redirect back after a sign-in is", () => {
    const pageLoad = {
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    }
    expect(allowed(pageLoad)).toBe(true)
    // Framed, or fetched: not a page the reader opened.
    expect(allowed({ ...pageLoad, "sec-fetch-dest": "iframe" })).toBe(false)
    expect(allowed({ ...pageLoad, "sec-fetch-mode": "no-cors", "sec-fetch-dest": "image" })).toBe(
      false,
    )
    // A cross-site form post is a page load too, but it names its origin.
    expect(allowed({ ...pageLoad, origin: "https://pr-12.pragmaticpapers.com" })).toBe(false)
  })

  it("refuses a request that names neither", () => {
    expect(allowed({})).toBe(false)
  })

  it("allows everything while the list is empty, as Payload does", () => {
    expect(allowed({ origin: "https://example.com" }, [])).toBe(true)
    expect(allowed({}, [])).toBe(true)
  })
})

describe("ssoStrategy", () => {
  it("signs nobody in from another origin, without reading the session", async () => {
    const result = await authenticate("pp-session=abc", {
      origin: "https://pr-12.pragmaticpapers.com",
    })
    expect(result).toEqual({ user: null })
    expect(getSession).not.toHaveBeenCalled()
  })

  it("signs in a page load, which sends no Origin", async () => {
    getSession.mockResolvedValue({ user: { id: "7" }, session: {} })
    findByID.mockResolvedValue({ id: 7, email: "editor@example.com", roles: ["editor"] })

    const result = await authenticate("pp-session=abc", { "sec-fetch-site": "none" })
    expect(result.user).toMatchObject({ id: 7 })
  })

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
