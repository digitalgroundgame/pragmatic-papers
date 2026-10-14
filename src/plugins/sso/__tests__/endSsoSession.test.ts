import type { Payload, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuth } from "../auth"
import { endSsoSession } from "../hooks/endSsoSession"
import type { ResolvedSsoConfig } from "../types"

vi.mock("../auth", () => ({ getAuth: vi.fn() }))

const set = vi.fn()
const cookies = vi.fn()
vi.mock("next/headers", () => ({ cookies: () => cookies() }))

const signOut = vi.fn()
const logger = { warn: vi.fn() }
const config = {
  cookieName: "pp-session",
  payloadUserCookie: "payload-token-sso",
} as ResolvedSsoConfig

const logout = (cookie?: string) =>
  endSsoSession(config)({
    req: {
      payload: { logger } as unknown as Payload,
      headers: new Headers(cookie ? { cookie } : {}),
    } as PayloadRequest,
  } as Parameters<ReturnType<typeof endSsoSession>>[0])

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuth).mockResolvedValue({ api: { signOut } } as never)
  cookies.mockResolvedValue({ set })
})

describe("endSsoSession", () => {
  it("does nothing for a password login", async () => {
    await logout("payload-token=abc")
    expect(getAuth).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  it("deletes the session and clears its cookies", async () => {
    await logout("pp-session=abc")

    expect(signOut).toHaveBeenCalledWith({ headers: expect.any(Headers) })
    for (const name of ["pp-session", "payload-token-sso"]) {
      expect(set).toHaveBeenCalledWith(name, "", expect.objectContaining({ maxAge: 0 }))
    }
  })

  it("still clears the cookie, and logs, when the session can't be deleted", async () => {
    signOut.mockRejectedValue(new Error("database is down"))

    await logout("pp-session=abc")

    expect(logger.warn).toHaveBeenCalled()
    expect(set).toHaveBeenCalled()
  })

  it("logs out through the Local API, where there's no cookie to clear", async () => {
    cookies.mockRejectedValue(new Error("no request scope"))
    await expect(logout("pp-session=abc")).resolves.toBeUndefined()
    expect(signOut).toHaveBeenCalled()
  })
})
