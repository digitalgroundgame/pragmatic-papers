import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidateTag }))

import { revalidateInteractive, revalidateInteractiveDelete } from "../revalidateInteractive"

interface Doc {
  id: number
  slug?: string | null
  _status?: "draft" | "published" | null
}

const req = (disableRevalidate = false) => ({
  payload: { logger: { info: vi.fn() } },
  context: { disableRevalidate },
})

const change = (doc: Doc, previousDoc?: Doc, disableRevalidate = false) =>
  ({ doc, previousDoc, req: req(disableRevalidate) }) as never

const PAGE_TAGS = [
  ["interactive:1", "max"],
  ["interactives-sitemap", "max"],
]

beforeEach(() => {
  revalidateTag.mockClear()
})

describe("revalidateInteractive", () => {
  it("drops the interactive's data and the sitemap when a version is published", () => {
    const doc = { id: 1, slug: "courts", _status: "published" as const }
    expect(revalidateInteractive(change(doc))).toBe(doc)
    expect(revalidateTag.mock.calls).toEqual(PAGE_TAGS)
  })

  it("leaves every cache alone for a draft of something never published", () => {
    const doc = { id: 1, slug: "courts", _status: "draft" as const }
    revalidateInteractive(change(doc, { ...doc }))
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("drops caches when a published interactive is unpublished", () => {
    revalidateInteractive(
      change(
        { id: 1, slug: "courts", _status: "draft" },
        { id: 1, slug: "courts", _status: "published" },
      ),
    )
    expect(revalidateTag.mock.calls).toEqual(PAGE_TAGS)
  })

  it("drops caches once per transition when a published slug moves", () => {
    revalidateInteractive(
      change(
        { id: 1, slug: "federal-courts", _status: "published" },
        { id: 1, slug: "courts", _status: "published" },
      ),
    )
    expect(revalidateTag.mock.calls).toEqual([...PAGE_TAGS, ...PAGE_TAGS])
  })

  it("does nothing when the caller disabled revalidation", () => {
    const doc = { id: 1, slug: "courts", _status: "published" as const }
    expect(revalidateInteractive(change(doc, undefined, true))).toBe(doc)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe("revalidateInteractiveDelete", () => {
  it("drops the interactive's data and the sitemap", () => {
    const doc = { id: 1, slug: "courts" }
    expect(revalidateInteractiveDelete({ doc, req: req() } as never)).toBe(doc)
    expect(revalidateTag.mock.calls).toEqual(PAGE_TAGS)
  })

  it("does nothing when the caller disabled revalidation", () => {
    revalidateInteractiveDelete({ doc: { id: 1, slug: "courts" }, req: req(true) } as never)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
