import { beforeEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()

vi.mock("@/utilities/getPayloadConfig", () => ({
  getPayloadConfig: async () => ({ find }),
}))

const { GET } = await import("../route")

const request = (authorization?: string): Request =>
  new Request("http://localhost/next/migrations", {
    headers: authorization ? { authorization } : {},
  })

describe("GET /next/migrations", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", "s3cret")
    find.mockReset().mockResolvedValue({
      docs: [{ name: "20260101_000000_initial" }, { name: "20261009_032243_hero_links" }],
    })
  })

  it("lists the migrations the database has run, uncached", async () => {
    const response = await GET(request("Bearer s3cret"))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({
      applied: ["20260101_000000_initial", "20261009_032243_hero_links"],
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "payload-migrations", pagination: false }),
    )
  })

  it("refuses a request without the secret, before touching the database", async () => {
    const response = await GET(request("Bearer nope"))

    expect(response.status).toBe(401)
    expect(find).not.toHaveBeenCalled()
  })
})
