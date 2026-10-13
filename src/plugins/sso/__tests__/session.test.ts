import type { Payload, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuth } from "../auth"
import { onlyPayloadUsers } from "../hooks/onlyPayloadUsers"
import { payloadUserCookiePlugin } from "../payloadUserCookie"
import { getSignedInUser, resolveSsoConfig } from "../session"
import type { ResolvedSsoConfig, SsoPluginConfig } from "../types"

vi.mock("../auth", () => ({ getAuth: vi.fn() }))
vi.mock("better-auth/api", () => ({
  createAuthMiddleware: (handler: unknown) => handler,
}))

const getSession = vi.fn()
const findByID = vi.fn()
const payload = {
  findByID,
  logger: { error: vi.fn() },
  db: { defaultIDType: "number" },
} as unknown as Payload

const isStaff = (user: Record<string, unknown>) =>
  ((user.roles as string[] | undefined) ?? []).includes("editor")

const options: SsoPluginConfig = {
  providers: () => ({}),
  baseURL: () => "https://example.com",
  secret: () => "secret",
  isPayloadUser: isStaff,
}
const config: ResolvedSsoConfig = resolveSsoConfig(options)

const editor = { id: 7, roles: ["editor"] }
const member = { id: 8, roles: ["member"] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuth).mockResolvedValue({ api: { getSession } } as never)
})

describe("resolveSsoConfig", () => {
  it("fills in the defaults, and drops `disabled`", () => {
    const resolved = resolveSsoConfig({ ...options, isPayloadUser: undefined, disabled: true })
    expect(resolved).toMatchObject({
      usersSlug: "users",
      cookieName: "pp-session",
      payloadUserCookie: "payload-token-sso",
      accountPath: "/account",
    })
    expect(resolved).not.toHaveProperty("disabled")
    expect(resolved.isPayloadUser({})).toBe(true)
  })
})

describe("getSignedInUser", () => {
  const request = (cookie: string | null, user: unknown = null) =>
    ({
      payload,
      headers: new Headers(cookie ? { cookie } : {}),
      user,
    }) as unknown as PayloadRequest

  it("is Payload's own user when there is one", async () => {
    const user = { ...editor, collection: "users" }
    expect(await getSignedInUser(request(null, user), options)).toBe(user)
    expect(getSession).not.toHaveBeenCalled()
  })

  it("is the member behind a session Payload doesn't accept", async () => {
    getSession.mockResolvedValue({ user: { id: "8" }, session: {} })
    findByID.mockResolvedValue(member)
    expect(await getSignedInUser(request("pp-session=abc"), options)).toEqual(member)
  })

  it("is nobody without a session", async () => {
    expect(await getSignedInUser(request(null), options)).toBeNull()
    expect(getSession).not.toHaveBeenCalled()
  })
})

describe("payloadUserCookiePlugin", () => {
  type Handler = (ctx: unknown) => Promise<void>
  const handler = payloadUserCookiePlugin(payload, config, true).hooks!.after![0]!
    .handler as unknown as Handler

  const run = async (path: string, newSession?: { user: { id: string } }) => {
    const setCookie = vi.fn()
    await handler({ path, setCookie, context: { newSession } })
    return setCookie
  }

  it("marks a staff sign-in for the cache rules", async () => {
    findByID.mockResolvedValue(editor)
    const setCookie = await run("/callback/:id", { user: { id: "7" } })
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
    expect(setCookie).toHaveBeenCalledWith(
      "payload-token-sso",
      "1",
      expect.objectContaining({ httpOnly: true, secure: true, maxAge: config.sessionSeconds }),
    )
  })

  it("clears the mark for a member's sign-in", async () => {
    findByID.mockResolvedValue(member)
    const setCookie = await run("/callback/:id", { user: { id: "8" } })
    expect(setCookie).toHaveBeenCalledWith(
      "payload-token-sso",
      "",
      expect.objectContaining({ maxAge: 0 }),
    )
  })

  it("clears it on sign-out, and leaves other requests alone", async () => {
    expect(await run("/sign-out")).toHaveBeenCalledWith(
      "payload-token-sso",
      "",
      expect.objectContaining({ maxAge: 0 }),
    )
    expect(await run("/get-session")).not.toHaveBeenCalled()
  })
})

describe("onlyPayloadUsers", () => {
  const login = (user: unknown) =>
    onlyPayloadUsers(config)({ user } as Parameters<ReturnType<typeof onlyPayloadUsers>>[0])

  it("lets staff log in with a password", () => {
    expect(login(editor)).toBe(editor)
  })

  it("refuses a member as if the password were wrong", () => {
    expect(() => login(member)).toThrow("The email or password provided is incorrect.")
  })
})
