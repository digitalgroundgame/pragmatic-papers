import { beforeEach, describe, expect, it, vi } from "vitest"

const { warmWorker, after } = vi.hoisted(() => ({
  warmWorker: vi.fn(async () => undefined),
  after: vi.fn(),
}))
const payload = { logger: { info: vi.fn(), warn: vi.fn() } }

vi.mock("@/hooks/warmWorker", () => ({ warmWorker }))
vi.mock("@/hooks/warmPages", () => ({ PURGE_SETTLE_MS: 0 }))
vi.mock("@/data/payload", () => ({ getPayloadClient: async () => payload }))
vi.mock("next/server", () => ({ after }))

const { POST } = await import("../route")

const request = (authorization?: string): Request =>
  new Request("http://localhost/next/warm-worker", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  })

describe("/next/warm-worker", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", "s3cret")
    vi.stubEnv("WORKER_URL", "https://worker.example.com")
    vi.clearAllMocks()
  })

  it("answers at once, then warms the Worker's pages", async () => {
    const response = await POST(request("Bearer s3cret"))

    await expect(response.json()).resolves.toEqual({ queued: true })
    expect(warmWorker).not.toHaveBeenCalled()

    const [[task]] = after.mock.calls as unknown as [[() => Promise<void>]]
    await task()

    expect(warmWorker).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it("says what's missing when the Worker isn't configured", async () => {
    vi.stubEnv("WORKER_URL", "")

    const body = await (await POST(request("Bearer s3cret"))).json()

    expect(body).toEqual({ queued: false, reason: expect.stringContaining("WORKER_URL") })
    expect(after).not.toHaveBeenCalled()
  })

  it.each([
    ["no header", undefined],
    ["the wrong secret", "Bearer nope"],
  ])("refuses a request with %s", async (_, authorization) => {
    expect((await POST(request(authorization))).status).toBe(401)
    expect(after).not.toHaveBeenCalled()
  })
})
