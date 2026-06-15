import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { verifyTurnstileToken } from "../turnstile"

function mockFetchOnce(opts: { ok: boolean; status?: number; json?: unknown }) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    json: () => Promise.resolve(opts.json ?? { success: true }),
  } as Response)
}

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_TURNSTILE_SECRET_KEY", "test-secret")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("throws when CLOUDFLARE_TURNSTILE_SECRET_KEY is missing", async () => {
    vi.stubEnv("CLOUDFLARE_TURNSTILE_SECRET_KEY", "")
    await expect(verifyTurnstileToken({ token: "t" })).rejects.toThrow("Missing required env var")
  })

  it("returns false for an empty token without calling fetch", async () => {
    const spy = vi.spyOn(global, "fetch")
    expect(await verifyTurnstileToken({ token: "" })).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it("returns true when siteverify responds with success: true", async () => {
    mockFetchOnce({ ok: true, json: { success: true } })
    expect(await verifyTurnstileToken({ token: "valid-token" })).toBe(true)
  })

  it("returns false when siteverify responds with success: false", async () => {
    mockFetchOnce({ ok: true, json: { success: false, "error-codes": ["invalid-input-response"] } })
    expect(await verifyTurnstileToken({ token: "bad-token" })).toBe(false)
  })

  it("throws when siteverify returns a non-2xx status", async () => {
    mockFetchOnce({ ok: false, status: 500 })
    await expect(verifyTurnstileToken({ token: "t" })).rejects.toThrow("500")
  })

  it("includes remoteip in the form body when ip is provided", async () => {
    const spy = mockFetchOnce({ ok: true, json: { success: true } })
    await verifyTurnstileToken({ token: "t", ip: "1.2.3.4" })
    const body = spy.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(body.get("remoteip")).toBe("1.2.3.4")
  })

  it("omits remoteip from the form body when ip is not provided", async () => {
    const spy = mockFetchOnce({ ok: true, json: { success: true } })
    await verifyTurnstileToken({ token: "t" })
    const body = spy.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(body.has("remoteip")).toBe(false)
  })
})
