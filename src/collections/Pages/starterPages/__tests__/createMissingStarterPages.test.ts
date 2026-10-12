import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMissingStarterPages, STARTER_PAGES } from ".."

const FEEDS_KEY = "seeded:pages:feeds"

const count = vi.fn()
const create = vi.fn()
const kv = { has: vi.fn(), set: vi.fn() }
const logger = { info: vi.fn(), error: vi.fn() }
const payload = { count, create, kv, logger } as never

const page = (slug: string) => ({ title: slug, slug, layout: [] }) as never

beforeEach(() => {
  vi.clearAllMocks()
  kv.has.mockResolvedValue(false)
  count.mockResolvedValue({ totalDocs: 0 })
  create.mockResolvedValue({})
})

describe("createMissingStarterPages", () => {
  it("creates a page the site has never had as an unpublished draft, and remembers it", async () => {
    await expect(createMissingStarterPages(payload, [page("feeds")])).resolves.toEqual(["feeds"])
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "pages", where: { slug: { equals: "feeds" } } }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "pages",
        draft: true,
        data: expect.objectContaining({ slug: "feeds", _status: "draft" }),
        context: { disableRevalidate: true },
      }),
    )
    expect(kv.set).toHaveBeenCalledWith(FEEDS_KEY, expect.any(Object))
  })

  it("keeps a page already at the slug, published or not, and remembers it", async () => {
    count.mockResolvedValue({ totalDocs: 1 })
    await expect(createMissingStarterPages(payload, [page("feeds")])).resolves.toEqual([])
    expect(create).not.toHaveBeenCalled()
    expect(kv.set).toHaveBeenCalledWith(FEEDS_KEY, expect.any(Object))
  })

  it("doesn't bring back a page the site has had, even once it's deleted", async () => {
    kv.has.mockResolvedValue(true)
    await expect(createMissingStarterPages(payload, [page("feeds")])).resolves.toEqual([])
    expect(count).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("logs a page it can't create, tries again next deploy, and carries on", async () => {
    create.mockRejectedValueOnce(new Error("connection refused"))
    await expect(createMissingStarterPages(payload, [page("a"), page("b")])).resolves.toEqual(["b"])
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "a" }),
      "Creating a starter page failed",
    )
    expect(kv.set).not.toHaveBeenCalledWith("seeded:pages:a", expect.anything())
    expect(kv.set).toHaveBeenCalledWith("seeded:pages:b", expect.any(Object))
  })

  it("ships /feeds, laid out with a Feed list for the feeds and one for the sitemaps", () => {
    const feeds = STARTER_PAGES.find((p) => p.slug === "feeds")
    expect(feeds?._status).toBeUndefined()
    expect(feeds?.layout.map((block) => block.blockType === "feedsList" && block.list)).toEqual([
      "feeds",
      "sitemaps",
    ])
  })
})
