// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utilities/listmonk", () => ({ subscribeMember: vi.fn() }))
vi.mock("@/utilities/turnstile", () => ({ verifyTurnstileToken: vi.fn() }))

import { subscribeMember } from "@/utilities/listmonk"
import { verifyTurnstileToken } from "@/utilities/turnstile"
import { POST } from "../route"

function makeReq(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request("http://localhost/api/newsletter/subscribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  })
}

describe("POST /api/newsletter/subscribe", () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it("returns 400 for an invalid email", async () => {
    const res = await POST(makeReq({ email: "not-an-email", turnstileToken: "t" }) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/valid email/i)
  })

  it("returns 400 for a missing email", async () => {
    const res = await POST(makeReq({ turnstileToken: "t" }) as never)
    expect(res.status).toBe(400)
  })

  it("returns 400 when Turnstile verification fails", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false)
    const res = await POST(makeReq({ email: "user@example.com", turnstileToken: "bad" }) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/verification failed/i)
  })

  it("returns 502 when subscribeMember throws", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    vi.mocked(subscribeMember).mockRejectedValue(new Error("Listmonk down"))
    const res = await POST(makeReq({ email: "user@example.com", turnstileToken: "t" }) as never)
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/couldn't subscribe/i)
  })

  it("returns 200 on success", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    vi.mocked(subscribeMember).mockResolvedValue(undefined)
    const res = await POST(makeReq({ email: "user@example.com", turnstileToken: "t" }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
