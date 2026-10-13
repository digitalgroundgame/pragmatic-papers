// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { draftsCollection, readersRow } from "@/utilities/__tests__/readersCopyHelpers"

// Every hook below changes what anonymous readers see, so each must purge the edge after
// clearing Next's cache — and none may when the caller disabled revalidation (seeds, syncs).

const { purgeEdgeCache } = vi.hoisted(() => ({ purgeEdgeCache: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))

const { revalidateHeader } = await import("@/Header/hooks/revalidateHeader")
const { revalidateFooter } = await import("@/Footer/hooks/revalidateFooter")
const { revalidatePage, revalidateDelete: revalidatePageDelete } =
  await import("@/collections/Pages/hooks/revalidatePage")
const { revalidateArticle: revalidateVolume, revalidateDelete: revalidateVolumeDelete } =
  await import("@/collections/Volumes/hooks/revalidateVolumes")
const { revalidateUser } = await import("@/collections/Users/hooks/revalidateUser")
const { revalidateMerchProduct, revalidateMerchProductDelete } =
  await import("@/collections/Merch/hooks/revalidateMerchProducts")

const payload = {
  logger: { info: vi.fn() },
  find: vi.fn().mockResolvedValue({ docs: [] }),
  findByID: readersRow(),
}
const req = (disableRevalidate = false) => ({ payload, context: { disableRevalidate } })
const args = (rest: Record<string, unknown>, disableRevalidate = false) =>
  ({ collection: draftsCollection("pages"), ...rest, req: req(disableRevalidate) }) as never

const published = (slug: string) => ({ id: 1, slug, _status: "published" })
const draft = (slug: string) => ({ id: 1, slug, _status: "draft" })

beforeEach(() => {
  purgeEdgeCache.mockClear()
})

describe("hooks that purge the edge", () => {
  it.each([
    ["header", () => revalidateHeader(args({ doc: {} })), "header saved"],
    ["footer", () => revalidateFooter(args({ doc: {} })), "footer saved"],
    [
      "a published page",
      () => revalidatePage(args({ doc: published("about"), previousDoc: draft("about") })),
      "page about",
      {
        paths: ["/about", "/sitemap.xml"],
        shared: false,
        revalidated: { paths: ["/about"], tags: ["pages-sitemap"] },
      },
    ],
    [
      "an unpublished page",
      () => revalidatePage(args({ doc: draft("about"), previousDoc: published("about") })),
      "page about unpublished",
      {
        paths: ["/about", "/sitemap.xml"],
        shared: false,
        revalidated: { paths: ["/about"], tags: ["pages-sitemap"] },
      },
    ],
    [
      "a deleted page",
      () => revalidatePageDelete(args({ doc: published("about") })),
      "page about deleted",
      {
        paths: ["/about", "/sitemap.xml"],
        shared: false,
        revalidated: { paths: ["/about"], tags: ["pages-sitemap"] },
      },
    ],
    [
      "a published volume",
      () => revalidateVolume(args({ doc: published("vol-1"), previousDoc: draft("vol-1") })),
      "volume vol-1",
      {
        paths: ["/volumes/vol-1", "/volumes/feed.xml"],
        shared: true,
        revalidated: { paths: ["/volumes/vol-1", "/volumes/feed.xml"], tags: ["volumes-sitemap"] },
      },
    ],
    [
      "an unpublished volume",
      () => revalidateVolume(args({ doc: draft("vol-1"), previousDoc: published("vol-1") })),
      "volume vol-1 unpublished",
      {
        paths: ["/volumes/vol-1", "/volumes/feed.xml"],
        shared: true,
        revalidated: { paths: ["/volumes/vol-1", "/volumes/feed.xml"], tags: ["volumes-sitemap"] },
      },
    ],
    [
      "a deleted volume",
      () => revalidateVolumeDelete(args({ doc: published("vol-1") })),
      "volume vol-1 deleted",
      {
        paths: ["/volumes/vol-1", "/volumes/feed.xml"],
        shared: true,
        revalidated: { paths: ["/volumes/vol-1", "/volumes/feed.xml"], tags: ["volumes-sitemap"] },
      },
    ],
    ["a merch product", () => revalidateMerchProduct(args({ doc: {} })), "merch product changed"],
    [
      "a deleted merch product",
      () => revalidateMerchProductDelete(args({ doc: {} })),
      "merch product deleted",
    ],
  ])("purges for %s", async (_, run, reason, ...options: unknown[]) => {
    await run()
    expect(purgeEdgeCache).toHaveBeenCalledWith(payload.logger, reason, ...options)
  })

  it("purges for an author", async () => {
    await revalidateUser(
      args({ doc: { id: 7, slug: "jane" }, previousDoc: { id: 7, slug: "jane" } }),
    )
    expect(purgeEdgeCache).toHaveBeenCalledWith(payload.logger, "author jane", {
      paths: ["/contributors/jane", "/contributors"],
      shared: true,
      revalidated: { paths: ["/contributors/jane", "/contributors"], tags: [] },
    })
  })

  it("leaves a never-published draft alone", async () => {
    await revalidatePage(args({ doc: draft("wip"), previousDoc: draft("wip") }))
    await revalidateVolume(args({ doc: draft("wip"), previousDoc: draft("wip") }))
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("purges nothing when revalidation is disabled", async () => {
    revalidateHeader(args({ doc: {} }, true))
    revalidateFooter(args({ doc: {} }, true))
    await revalidatePage(args({ doc: published("about"), previousDoc: draft("about") }, true))
    revalidatePageDelete(args({ doc: published("about") }, true))
    await revalidateVolume(args({ doc: published("vol-1"), previousDoc: draft("vol-1") }, true))
    revalidateVolumeDelete(args({ doc: published("vol-1") }, true))
    revalidateMerchProduct(args({ doc: {} }, true))
    revalidateMerchProductDelete(args({ doc: {} }, true))
    await revalidateUser(args({ doc: { id: 7, slug: "jane" } }, true))
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })
})
