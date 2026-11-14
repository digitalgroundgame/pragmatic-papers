// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"
import { failure, success } from "@/utilities/result"

const { queryInteractiveBySlug, loadWhipCount } = vi.hoisted(() => ({
  queryInteractiveBySlug: vi.fn(),
  loadWhipCount: vi.fn(),
}))
vi.mock("@/interactives/load", () => ({ queryInteractiveBySlug }))
vi.mock("@/interactives/whip-count/load", () => ({ loadWhipCount }))

const { GET } = await import("../route")

const get = (): Promise<Response> =>
  GET(new Request("http://localhost/next/whip-counts/leader/image"), {
    params: Promise.resolve({ slug: "leader" }),
  })

describe("GET /next/whip-counts/[slug]/image", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryInteractiveBySlug.mockResolvedValue({ id: 3, title: "Who leads?", profile: "whip-count" })
    loadWhipCount.mockResolvedValue(
      success({ ...whipCountData, voteAt: "2026-12-01T09:30:00-05:00" }),
    )
  })

  it("draws the count as a 1200×630 PNG the edge may keep", async () => {
    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400")
    const bytes = new Uint8Array(await response.arrayBuffer())
    // A PNG's IHDR holds its width and height, big-endian, at bytes 16 and 20.
    const view = new DataView(bytes.buffer)
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630])
  }, 30_000)

  it("is not found for a missing interactive, a map, or a count never pushed", async () => {
    queryInteractiveBySlug.mockResolvedValueOnce(null)
    expect((await get()).status).toBe(404)
    queryInteractiveBySlug.mockResolvedValueOnce({
      id: 4,
      title: "Courts",
      profile: "federal-courts",
    })
    expect((await get()).status).toBe(404)
    loadWhipCount.mockResolvedValueOnce(failure("no count"))
    expect((await get()).status).toBe(404)
  })
})
