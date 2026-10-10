import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { find, draft, cached } = vi.hoisted(() => ({
  find: vi.fn(),
  draft: { isEnabled: false },
  cached: vi.fn(),
}))

vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => ({ find }) }))
vi.mock("next/headers", () => ({ draftMode: async () => draft }))
// Runs the query straight through, recording the key and tags it was cached under.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown, keys: string[], options: { tags: string[] }) => () => {
    cached(keys, options.tags)
    return fn()
  },
}))
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  cache: <T>(fn: T) => fn,
}))

import { queryDocBySlug, queryPublishedDocs } from "../queries"

const doc = { id: 1, slug: "unsplash-photos", title: "Unsplash photos" }

beforeEach(() => {
  vi.clearAllMocks()
  draft.isEnabled = false
  find.mockResolvedValue({ docs: [doc] })
})

describe("queryPublishedDocs", () => {
  it("lists published docs newest first, as the reader sees them, without content", async () => {
    await expect(queryPublishedDocs()).resolves.toEqual([doc])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "docs",
        draft: false,
        overrideAccess: false,
        sort: "-publishedAt",
        select: expect.not.objectContaining({ content: true }),
      }),
    )
    expect(cached).toHaveBeenCalledWith(["docs-published"], ["docs"])
  })
})

describe("queryDocBySlug", () => {
  it("reads the published doc, cached by slug", async () => {
    await expect(queryDocBySlug("unsplash-photos")).resolves.toEqual(doc)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        overrideAccess: false,
        where: { slug: { equals: "unsplash-photos" } },
      }),
    )
    expect(cached).toHaveBeenCalledWith(["doc", "unsplash-photos"], ["docs"])
  })

  it("reads the latest draft, uncached, in a draft preview", async () => {
    draft.isEnabled = true
    await queryDocBySlug("unsplash-photos")
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true, overrideAccess: true }),
    )
    expect(cached).not.toHaveBeenCalled()
  })

  it("is null for a slug no doc has", async () => {
    find.mockResolvedValue({ docs: [] })
    await expect(queryDocBySlug("nope")).resolves.toBeNull()
  })
})
