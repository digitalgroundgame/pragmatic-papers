// @vitest-environment node
import type { Article } from "@/payload-types"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { revalidatePath, revalidateTag } = await import("next/cache")
const { revalidateArticle, revalidateDelete } = await import("../revalidateArticle")

const payload = {
  logger: { info: vi.fn() },
  find: vi.fn().mockResolvedValue({ docs: [{ slug: "volume-1" }] }),
}

const doc = (slug: string, status: Article["_status"]) => ({ slug, _status: status }) as Article
const req = (context: Record<string, unknown> = {}) => ({ payload, context }) as never
const paths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)

afterEach(() => {
  vi.clearAllMocks()
})

describe("revalidateArticle", () => {
  it("refreshes the article, its feeds and the volumes that list it when published", async () => {
    await revalidateArticle({
      doc: doc("new-piece", "published"),
      previousDoc: doc("new-piece", "draft"),
      req: req(),
    } as never)

    expect(paths()).toEqual([
      "/articles/new-piece",
      "/feed.articles",
      "/articles/substack.xml",
      "/articles/new-piece/substack.xml",
      "/volumes/volume-1",
    ])
    expect(revalidateTag).toHaveBeenCalledWith("articles-sitemap", "max")
  })

  it("refreshes the old paths when a published article is unpublished", async () => {
    await revalidateArticle({
      doc: doc("pulled", "draft"),
      previousDoc: doc("pulled", "published"),
      req: req(),
    } as never)

    expect(paths()).toContain("/articles/substack.xml")
    expect(paths()).toContain("/articles/pulled/substack.xml")
  })

  it("also refreshes the old slug's paths when a published article is renamed", async () => {
    await revalidateArticle({
      doc: doc("new-slug", "published"),
      previousDoc: doc("old-slug", "published"),
      req: req(),
    } as never)

    expect(paths()).toEqual(
      expect.arrayContaining([
        "/articles/new-slug",
        "/articles/new-slug/substack.xml",
        "/articles/old-slug",
        "/articles/old-slug/substack.xml",
      ]),
    )
  })

  it("refreshes a republished article's paths once when its slug is unchanged", async () => {
    await revalidateArticle({
      doc: doc("same", "published"),
      previousDoc: doc("same", "published"),
      req: req(),
    } as never)

    expect(paths().filter((path) => path === "/articles/same/substack.xml")).toHaveLength(1)
  })

  it("does nothing for a draft that was never published", async () => {
    await revalidateArticle({
      doc: doc("draft", "draft"),
      previousDoc: doc("draft", "draft"),
      req: req(),
    } as never)

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("does nothing when revalidation is disabled", async () => {
    await revalidateArticle({
      doc: doc("seeded", "published"),
      previousDoc: doc("seeded", "draft"),
      req: req({ disableRevalidate: true }),
    } as never)

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe("revalidateDelete", () => {
  it("refreshes the deleted article's feed paths", async () => {
    await revalidateDelete({ doc: doc("gone", "published"), req: req() } as never)

    expect(paths()).toContain("/articles/substack.xml")
    expect(paths()).toContain("/articles/gone/substack.xml")
  })
})
