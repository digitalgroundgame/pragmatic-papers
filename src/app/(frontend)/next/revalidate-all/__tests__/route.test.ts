import { beforeEach, describe, expect, it, vi } from "vitest"

const { purgeEdgeCache, revalidatePath, syncRepoDocs } = vi.hoisted(() => ({
  purgeEdgeCache: vi.fn(),
  revalidatePath: vi.fn(),
  syncRepoDocs: vi.fn(),
}))
const payload = { logger: { info: vi.fn(), warn: vi.fn() } }

vi.mock("next/cache", () => ({ revalidatePath }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))
vi.mock("@/plugins/docs/syncRepoDocs", () => ({ syncRepoDocs }))
vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => payload }))

const { DEPLOY_REPURGE_MS, POST } = await import("../route")

const request = (authorization?: string): Request =>
  new Request("http://localhost/next/revalidate-all", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  })

describe("POST /next/revalidate-all", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", "s3cret")
    vi.clearAllMocks()
    syncRepoDocs.mockResolvedValue({ created: ["a"], updated: [], unchanged: ["b"] })
  })

  it("syncs the repo's docs, then throws away every prerendered route", async () => {
    const response = await POST(request("Bearer s3cret"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      docs: { created: ["a"], updated: [] },
    })
    expect(syncRepoDocs).toHaveBeenCalledExactlyOnceWith(payload)
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/", "layout")
    expect(syncRepoDocs.mock.invocationCallOrder[0]).toBeLessThan(
      revalidatePath.mock.invocationCallOrder[0]!,
    )
  })

  it("purges the edge now, and again once traffic has moved to the new container", async () => {
    vi.useFakeTimers()
    try {
      await POST(request("Bearer s3cret"))

      expect(purgeEdgeCache).toHaveBeenCalledExactlyOnceWith(payload.logger, "deploy")
      expect(purgeEdgeCache.mock.invocationCallOrder[0]).toBeGreaterThan(
        revalidatePath.mock.invocationCallOrder[0]!,
      )

      vi.advanceTimersByTime(DEPLOY_REPURGE_MS - 1)
      expect(purgeEdgeCache).toHaveBeenCalledOnce()
      vi.advanceTimersByTime(1)
      expect(purgeEdgeCache).toHaveBeenLastCalledWith(
        payload.logger,
        "deploy, after the switchover",
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("still revalidates when the docs sync fails", async () => {
    syncRepoDocs.mockResolvedValue(null)
    const response = await POST(request("Bearer s3cret"))

    await expect(response.json()).resolves.toEqual({ revalidated: true, docs: null })
    expect(revalidatePath).toHaveBeenCalledOnce()
  })

  it.each([
    ["no header", undefined],
    ["the wrong secret", "Bearer nope"],
    ["the secret without the Bearer scheme", "s3cret"],
    ["a prefix of the secret", "Bearer s3cre"],
  ])("refuses a request with %s", async (_, authorization) => {
    const response = await POST(request(authorization))

    expect(response.status).toBe(401)
    expect(syncRepoDocs).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("refuses everything when PAYLOAD_SECRET is unset", async () => {
    vi.stubEnv("PAYLOAD_SECRET", "")

    expect((await POST(request("Bearer "))).status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
