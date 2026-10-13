import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidatePath, syncRepoDocs, createMissingStarterPages } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  syncRepoDocs: vi.fn(),
  createMissingStarterPages: vi.fn(),
}))
const payload = {}

vi.mock("next/cache", () => ({ revalidatePath }))
vi.mock("@/plugins/docs/syncRepoDocs", () => ({ syncRepoDocs }))
vi.mock("@/collections/Pages/starterPages", () => ({ createMissingStarterPages }))
vi.mock("@/data/payload", () => ({ getPayloadClient: async () => payload }))

const { POST } = await import("../route")

const request = (authorization?: string, query = ""): Request =>
  new Request(`http://localhost/next/revalidate-all${query}`, {
    method: "POST",
    headers: authorization ? { authorization } : {},
  })

describe("POST /next/revalidate-all", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", "s3cret")
    vi.clearAllMocks()
    syncRepoDocs.mockResolvedValue({ created: ["a"], existing: ["b"], deleted: [] })
    createMissingStarterPages.mockResolvedValue(["feeds"])
  })

  it("syncs the repo's docs and starter pages, then throws away every prerendered route", async () => {
    const response = await POST(request("Bearer s3cret"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      docs: { created: ["a"] },
      pages: { created: ["feeds"] },
    })
    expect(syncRepoDocs).toHaveBeenCalledExactlyOnceWith(payload)
    expect(createMissingStarterPages).toHaveBeenCalledExactlyOnceWith(payload)
    expect(createMissingStarterPages.mock.invocationCallOrder[0]).toBeLessThan(
      revalidatePath.mock.invocationCallOrder[0]!,
    )
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/", "layout")
    expect(syncRepoDocs.mock.invocationCallOrder[0]).toBeLessThan(
      revalidatePath.mock.invocationCallOrder[0]!,
    )
  })

  it("skips the deploy's seeding for a save", async () => {
    const response = await POST(request("Bearer s3cret", "?save=1&path=/articles/a"))

    await expect(response.json()).resolves.toEqual({ revalidated: true })
    expect(syncRepoDocs).not.toHaveBeenCalled()
    expect(createMissingStarterPages).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/", "layout")
  })

  it("still revalidates when the docs sync fails", async () => {
    syncRepoDocs.mockResolvedValue(null)
    const response = await POST(request("Bearer s3cret"))

    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      docs: null,
      pages: { created: ["feeds"] },
    })
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
  })

  it("refuses everything when PAYLOAD_SECRET is unset", async () => {
    vi.stubEnv("PAYLOAD_SECRET", "")

    expect((await POST(request("Bearer "))).status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
