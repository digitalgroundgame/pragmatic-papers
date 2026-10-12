import type { Payload, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuth } from "../auth"
import { authEndpoints } from "../endpoints/auth"
import type { ResolvedSsoConfig } from "../types"

vi.mock("../auth", () => ({ getAuth: vi.fn() }))

const handler = vi.fn(async (_request: Request) => Response.json({ ok: true }))
const enabled = vi.fn()
const config = { enabled } as unknown as ResolvedSsoConfig
const payload = {} as Payload

const [get, post] = authEndpoints(config)

const call = (method: "GET" | "POST", body?: string) =>
  (method === "GET" ? get : post)!.handler({
    payload,
    method,
    url: "https://example.com/api/auth/sign-in/social",
    headers: new Headers({ "content-type": "application/json" }),
    body: body ? new Response(body).body : undefined,
  } as unknown as PayloadRequest)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuth).mockResolvedValue({ handler } as never)
  enabled.mockResolvedValue(true)
})

describe("authEndpoints", () => {
  it("mounts every Better Auth route under /auth, for GET and POST", () => {
    expect(authEndpoints(config).map(({ path, method }) => [method, path])).toEqual([
      ["get", "/auth/:path*"],
      ["post", "/auth/:path*"],
    ])
  })

  it("answers 404 without starting Better Auth while single sign-on is off", async () => {
    enabled.mockResolvedValue(false)

    const response = await call("POST", "{}")

    expect(response.status).toBe(404)
    expect(enabled).toHaveBeenCalledWith({ payload })
    expect(getAuth).not.toHaveBeenCalled()
  })

  it("hands Better Auth the request with its body", async () => {
    const response = await call("POST", '{"provider":"google"}')

    expect(await response.json()).toEqual({ ok: true })
    const request = handler.mock.calls[0]![0]
    expect(request.method).toBe("POST")
    expect(request.url).toBe("https://example.com/api/auth/sign-in/social")
    expect(request.headers.get("content-type")).toBe("application/json")
    expect(await request.json()).toEqual({ provider: "google" })
  })

  it("hands over a GET without a body", async () => {
    await call("GET")
    const request = handler.mock.calls[0]![0]
    expect(request.method).toBe("GET")
    expect(request.body).toBeNull()
  })
})
