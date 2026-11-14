// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"
import { failure, success } from "@/utilities/result"

const { loadWhipCount } = vi.hoisted(() => ({ loadWhipCount: vi.fn() }))
vi.mock("../load", () => ({ loadWhipCount }))

const { whipCountMeta } = await import("../meta")

const page = {
  title: "Who leads?",
  openGraph: { title: "Who leads?", siteName: "The Pragmatic Papers" },
  twitter: { title: "Who leads?" },
}
const interactive = { id: 3, title: "Who leads?", meta: {} }
const now = new Date("2026-11-14T17:00:00Z")

describe("whipCountMeta", () => {
  it("puts the count in the title and the generated card in the link preview", async () => {
    loadWhipCount.mockResolvedValue(success(whipCountData))
    const meta = await whipCountMeta(page, interactive, "leader", now)
    expect(meta.title).toBe("Marion Hale 3, Daniel Ortiz 2: Who leads?")
    expect(meta.openGraph).toMatchObject({
      title: meta.title,
      siteName: "The Pragmatic Papers",
      images: [
        {
          url: expect.stringMatching(/\/next\/whip-counts\/leader\/image\?v=.+-none$/),
          width: 1200,
          height: 630,
          alt: "The whip count: 3 publicly back Marion Hale, 2 publicly back Daniel Ortiz.",
        },
      ],
    })
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: meta.title })
  })

  it("starts from an editor's SEO title when there is one", async () => {
    loadWhipCount.mockResolvedValue(success(whipCountData))
    const meta = await whipCountMeta(
      page,
      { ...interactive, meta: { title: "The caucus vote" } },
      "leader",
      now,
    )
    expect(meta.title).toBe("Marion Hale 3, Daniel Ortiz 2: The caucus vote")
  })

  it("draws the card even when an editor picked a meta image, so the count stays current", async () => {
    loadWhipCount.mockResolvedValue(success(whipCountData))
    const picked = { url: "https://example.com/picked.jpg" }
    const meta = await whipCountMeta(
      {
        ...page,
        openGraph: { ...page.openGraph, images: [picked] },
        twitter: { images: [picked] },
      },
      { ...interactive, meta: { image: 88 } },
      "leader",
      now,
    )
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({ url: expect.stringContaining("/image?v=") }),
    ])
    expect(meta.twitter?.images).toEqual([
      expect.objectContaining({ url: expect.stringContaining("/image?v=") }),
    ])
  })

  it("leaves the page's metadata alone with no count to read", async () => {
    loadWhipCount.mockResolvedValue(failure("no count"))
    expect(await whipCountMeta(page, interactive, "leader", now)).toBe(page)
  })
})
