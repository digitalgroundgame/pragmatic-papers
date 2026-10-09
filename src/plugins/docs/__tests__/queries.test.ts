import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { find, auth, draft, cached } = vi.hoisted(() => ({
  find: vi.fn(),
  auth: vi.fn(),
  draft: { isEnabled: false },
  cached: vi.fn(),
}))

vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => ({ find, auth }) }))
vi.mock("next/headers", () => ({
  draftMode: async () => draft,
  headers: async () => new Headers(),
}))
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
import { markDocsSynced } from "../syncVersion"

const doc = { id: 1, slug: "unsplash-photos", title: "Unsplash photos" }

beforeEach(() => {
  vi.clearAllMocks()
  draft.isEnabled = false
  find.mockResolvedValue({ docs: [doc] })
  auth.mockResolvedValue({ user: null })
})

const signedIn = (roles: string[]) => auth.mockResolvedValue({ user: { id: 1, roles } })

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
    expect(cached).toHaveBeenCalledWith(["docs-published", expect.any(String)], ["docs"])
  })

  it("reads every published doc for staff, cached apart from the visitors' list", async () => {
    await queryPublishedDocs({ staff: true })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideAccess: true,
        where: { _status: { equals: "published" } },
      }),
    )
    expect(cached).toHaveBeenCalledWith(["docs-published-staff", expect.any(String)], ["docs"])
  })

  it("caches under a new key once the start-up sync has written docs", async () => {
    await queryPublishedDocs()
    markDocsSynced()
    await queryPublishedDocs()
    const [before, after] = cached.mock.calls.map(([keys]) => keys as string[])
    expect(after).not.toEqual(before)
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
    expect(cached).toHaveBeenCalledWith(["doc", "unsplash-photos", expect.any(String)], ["docs"])
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
    expect(find).toHaveBeenCalledTimes(1)
  })

  it("finds a doc written for some roles only when staff ask", async () => {
    signedIn(["editor"])
    find.mockResolvedValueOnce({ docs: [] })
    await expect(queryDocBySlug("experiments")).resolves.toEqual(doc)
    expect(find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overrideAccess: true,
        where: { slug: { equals: "experiments" }, _status: { equals: "published" } },
      }),
    )
    expect(cached).toHaveBeenLastCalledWith(
      ["doc-staff", "experiments", expect.any(String)],
      ["docs"],
    )
  })

  it("keeps it from a signed-in reader who isn't staff", async () => {
    signedIn([])
    find.mockResolvedValue({ docs: [] })
    await expect(queryDocBySlug("experiments")).resolves.toBeNull()
    expect(find).toHaveBeenCalledTimes(1)
  })
})
