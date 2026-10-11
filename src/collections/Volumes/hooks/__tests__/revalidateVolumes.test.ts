// @vitest-environment node
import type { Volume } from "@/payload-types"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { revalidatePath, revalidateTag } = await import("next/cache")
const { revalidateArticle, revalidateDelete } = await import("../revalidateVolumes")

const payload = { logger: { info: vi.fn() } }

const doc = (slug: string, status: Volume["_status"]) => ({ slug, _status: status }) as Volume
const req = (context: Record<string, unknown> = {}) => ({ payload, context }) as never
const paths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)

afterEach(() => {
  vi.clearAllMocks()
})

describe("revalidateVolumes", () => {
  it("refreshes the volume and the volumes feed when published", () => {
    revalidateArticle({
      doc: doc("1", "published"),
      previousDoc: doc("1", "draft"),
      req: req(),
    } as never)

    expect(paths()).toEqual(["/volumes/1", "/volumes/feed.xml"])
    expect(revalidateTag).toHaveBeenCalledWith("volumes-sitemap", "max")
  })

  it("refreshes the old path and the feed when a published volume is unpublished", () => {
    revalidateArticle({
      doc: doc("2", "draft"),
      previousDoc: doc("2", "published"),
      req: req(),
    } as never)

    expect(paths()).toEqual(["/volumes/2", "/volumes/feed.xml"])
  })

  it("refreshes the volume and the feed when deleted", () => {
    revalidateDelete({ doc: doc("3", "published"), req: req() } as never)

    expect(paths()).toEqual(["/volumes/3", "/volumes/feed.xml"])
  })

  it("does nothing when revalidation is disabled", () => {
    revalidateArticle({
      doc: doc("4", "published"),
      previousDoc: doc("4", "draft"),
      req: req({ disableRevalidate: true }),
    } as never)

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
