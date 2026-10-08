import type { PayloadRequest } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { unsplash } from "@/integrations"
import type { UnsplashPhoto } from "@/integrations/unsplash"
import type { Media } from "@/payload-types"

import { attributeUnsplashPhoto, unsplashCredit, withCredit } from "../attributeUnsplashPhoto"

const photo: UnsplashPhoto = {
  id: "abc123",
  width: 6000,
  height: 4000,
  color: null,
  alt: "a lighthouse at dusk",
  thumbUrl: "https://images.unsplash.com/photo-1?w=400",
  rawUrl: "https://images.unsplash.com/photo-1",
  pageUrl: "https://unsplash.com/photos/abc123",
  downloadLocation: "https://api.unsplash.com/photos/abc123/download",
  photographer: {
    name: "Ada Lovelace",
    username: "ada",
    profileUrl: "https://unsplash.com/@ada?r",
  },
}

const logger = { error: vi.fn(), warn: vi.fn() }
const req = { payload: { logger } } as unknown as PayloadRequest

const run = (data: Partial<Media>, originalDoc?: Partial<Media>) =>
  attributeUnsplashPhoto({
    data,
    originalDoc,
    req,
    operation: originalDoc ? "update" : "create",
  } as Parameters<typeof attributeUnsplashPhoto>[0]) as Promise<Partial<Media>>

/** The caption's paragraphs as plain text, links as `[label](url)`. */
interface N {
  type: string
  text?: string
  children?: N[]
  fields?: { url?: string; newTab?: boolean }
}

function captionText(caption: Media["caption"]): string[] {
  const flat = (n: N): string =>
    n.type === "link"
      ? `[${(n.children ?? []).map(flat).join("")}](${n.fields?.url})`
      : (n.text ?? (n.children ?? []).map(flat).join(""))
  return (caption?.root.children as N[] | undefined)?.map(flat) ?? []
}

beforeEach(() => {
  vi.spyOn(unsplash, "photo").mockResolvedValue(photo)
  vi.spyOn(unsplash, "trackDownload").mockResolvedValue()
  vi.spyOn(unsplash, "homeUrl").mockReturnValue("https://unsplash.com/?r")
})

afterEach(() => {
  vi.restoreAllMocks()
  logger.error.mockReset()
  logger.warn.mockReset()
})

describe("attributeUnsplashPhoto", () => {
  it("credits the photographer, fills the alt text and counts the download", async () => {
    const data = await run({ unsplashId: "abc123" })

    expect(unsplash.photo).toHaveBeenCalledWith("abc123")
    expect(captionText(data.caption)).toEqual([
      "Photo by [Ada Lovelace](https://unsplash.com/@ada?r) on [Unsplash](https://unsplash.com/?r).",
    ])
    expect(data.alt).toBe("a lighthouse at dusk")
    expect(unsplash.trackDownload).toHaveBeenCalledWith(photo)
  })

  it("keeps the editor's alt text and caption, adding the credit after it", async () => {
    const caption = withCredit(null, {
      type: "paragraph",
      version: 1,
      children: [{ type: "text", text: "Dusk over the bay.", version: 1 }],
    })

    const data = await run({ unsplashId: "abc123", alt: "Their words", caption })

    expect(data.alt).toBe("Their words")
    expect(captionText(data.caption)).toEqual([
      "Dusk over the bay.",
      "Photo by [Ada Lovelace](https://unsplash.com/@ada?r) on [Unsplash](https://unsplash.com/?r).",
    ])
  })

  it("does nothing for media that didn't come from Unsplash, or whose photo hasn't changed", async () => {
    await run({ alt: "x" })
    await run({ unsplashId: "abc123" }, { unsplashId: "abc123" })

    expect(unsplash.photo).not.toHaveBeenCalled()
    expect(unsplash.trackDownload).not.toHaveBeenCalled()
  })

  it("fails the save, rather than keeping an uncredited photo, when Unsplash can't be reached", async () => {
    vi.mocked(unsplash.photo).mockRejectedValue(new Error("HTTP 503"))

    await expect(run({ unsplashId: "abc123" })).rejects.toThrow(
      "Couldn't reach Unsplash to credit this photo's photographer",
    )
    expect(unsplash.trackDownload).not.toHaveBeenCalled()
  })

  it("still saves when only counting the download fails", async () => {
    vi.mocked(unsplash.trackDownload).mockRejectedValue(new Error("HTTP 500"))

    const data = await run({ unsplashId: "abc123" })
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled())

    expect(captionText(data.caption)).toHaveLength(1)
  })
})

describe("unsplashCredit", () => {
  it("opens both links in a new tab", () => {
    const credit = unsplashCredit(photo, "https://unsplash.com/?r") as unknown as N
    const links = (credit.children ?? []).filter((c) => c.type === "link")
    expect(links.map((l) => l.fields?.newTab)).toEqual([true, true])
  })
})
