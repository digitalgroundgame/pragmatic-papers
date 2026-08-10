import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react")
  // React's `cache` memoizes per request; identity-based memoization isn't the
  // behavior under test here, so unwrap it.
  return { ...actual, cache: <T>(fn: T): T => fn }
})

vi.mock("next/headers", () => ({
  draftMode: vi.fn(async () => ({ isEnabled: false })),
}))

vi.mock("../getPayloadConfig", () => ({
  getPayloadConfig: vi.fn(async () => ({ find })),
}))

const { queryVolumesForArticles } = await import("../queries")

describe("queryVolumesForArticles", () => {
  beforeEach(() => {
    find.mockReset()
    find.mockResolvedValue({ docs: [{ id: 1, title: "Volume I" }] })
  })

  it("resolves the volumes containing the given articles in a single query", async () => {
    const volumes = await queryVolumesForArticles([3, 1, 2])

    expect(find).toHaveBeenCalledTimes(1)
    expect(find.mock.calls[0]?.[0]).toMatchObject({
      collection: "volumes",
      where: { articles: { in: [1, 2, 3] } },
      depth: 0,
    })
    expect(volumes).toEqual([{ id: 1, title: "Volume I" }])
  })

  it("de-duplicates article IDs", async () => {
    await queryVolumesForArticles([5, 5, 9, 5])

    expect(find.mock.calls[0]?.[0].where).toEqual({ articles: { in: [5, 9] } })
  })

  it("does not query when there are no article IDs", async () => {
    const volumes = await queryVolumesForArticles([])

    expect(find).not.toHaveBeenCalled()
    expect(volumes).toEqual([])
  })
})
