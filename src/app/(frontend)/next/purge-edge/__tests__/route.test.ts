import { beforeEach, describe, expect, it, vi } from "vitest"

const { purgeEdgeCache } = vi.hoisted(() => ({ purgeEdgeCache: vi.fn() }))
const payload = { logger: { info: vi.fn(), warn: vi.fn() } }

vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))
vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => payload }))

const { GET, POST } = await import("../route")

const request = (method: "GET" | "POST", authorization?: string): Request =>
  new Request("http://localhost/next/purge-edge", {
    method,
    headers: authorization ? { authorization } : {},
  })

describe("/next/purge-edge", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", "s3cret")
    vi.stubEnv("INSTANCE_ID", "abc-123")
    vi.clearAllMocks()
  })

  it("names the container that answered, uncached", async () => {
    const response = GET(request("GET", "Bearer s3cret"))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ instance: "abc-123" })
  })

  it("answers null outside a container start.sh launched", async () => {
    vi.stubEnv("INSTANCE_ID", undefined)

    await expect(GET(request("GET", "Bearer s3cret")).json()).resolves.toEqual({ instance: null })
  })

  it("purges the edge on POST", async () => {
    const response = await POST(request("POST", "Bearer s3cret"))

    expect(response.status).toBe(200)
    expect(purgeEdgeCache).toHaveBeenCalledExactlyOnceWith(payload.logger, "deploy")
  })

  it.each([
    ["no header", undefined],
    ["the wrong secret", "Bearer nope"],
  ])("refuses a request with %s", async (_, authorization) => {
    expect(GET(request("GET", authorization)).status).toBe(401)
    expect((await POST(request("POST", authorization))).status).toBe(401)
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })
})
