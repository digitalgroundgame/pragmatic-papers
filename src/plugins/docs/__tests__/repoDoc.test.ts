import { describe, expect, it } from "vitest"

import {
  hashRepoDoc,
  mediaFilename,
  mediaRefsIn,
  packMedia,
  repoFilename,
  unpackMedia,
} from "../repoDoc"

const media = {
  id: 7,
  filename: "docs-unsplash-photos-0123abcd-search-drawer.png",
  mimeType: "image/png",
  alt: "The search drawer",
  url: "/api/media/file/docs-unsplash-photos-0123abcd-search-drawer.png",
}

const content = {
  root: {
    children: [
      { type: "paragraph", children: [{ type: "text", text: "Hello" }] },
      { type: "block", fields: { blockType: "mediaBlock", id: "b1", media } },
      { type: "block", fields: { blockType: "mediaBlock", id: "b2", media } },
    ],
  },
}

describe("packMedia", () => {
  it("swaps populated media for a reference to its file, once per file", () => {
    const packed = packMedia("unsplash-photos", content)
    expect(packed.media.size).toBe(1)
    expect(packed.media.get("unsplash-photos-search-drawer.png")).toBe(media)
    expect(mediaRefsIn(packed.content)).toEqual([
      { $media: "unsplash-photos-search-drawer.png", alt: "The search drawer" },
    ])
  })

  it("round-trips through unpackMedia to ids", () => {
    const { content: packed } = packMedia("unsplash-photos", content)
    const unpacked = unpackMedia(
      packed,
      new Map([["unsplash-photos-search-drawer.png", 12]]),
    ) as typeof content
    expect(unpacked.root.children[1]).toEqual({
      type: "block",
      fields: { blockType: "mediaBlock", id: "b1", media: 12 },
    })
  })

  it("refuses a reference with no upload", () => {
    const { content: packed } = packMedia("unsplash-photos", content)
    expect(() => unpackMedia(packed, new Map())).toThrow("search-drawer.png")
  })

  it("names a file as told, by Media id", () => {
    const packed = packMedia("unsplash-photos", content, new Map([[7, "unsplash-photos-hero.png"]]))
    expect([...packed.media.keys()]).toEqual(["unsplash-photos-hero.png"])
  })
})

describe("media filenames", () => {
  it("names an upload by its content, and recovers the repo name", () => {
    const name = mediaFilename("unsplash-photos-a.png", Buffer.from("one"))
    expect(name).toMatch(/^docs-[0-9a-f]{8}-unsplash-photos-a\.png$/)
    expect(mediaFilename("unsplash-photos-a.png", Buffer.from("two"))).not.toBe(name)
    expect(repoFilename("unsplash-photos", name)).toBe("unsplash-photos-a.png")
  })

  it("starts a repo name with the slug", () => {
    expect(repoFilename("unsplash-photos", "uploaded-by-hand.png")).toBe(
      "unsplash-photos-uploaded-by-hand.png",
    )
    expect(repoFilename("unsplash-photos", "docs-unsplash-photos-0123abcd-hero.webp")).toBe(
      "unsplash-photos-hero.webp",
    )
  })
})

describe("hashRepoDoc", () => {
  it("changes with the doc's file, its section or any picture", () => {
    const base = hashRepoDoc("media", "---", [Buffer.from("a")])
    expect(hashRepoDoc("media", "---", [Buffer.from("a")])).toBe(base)
    expect(hashRepoDoc("site", "---", [Buffer.from("a")])).not.toBe(base)
    expect(hashRepoDoc("media", "--- ", [Buffer.from("a")])).not.toBe(base)
    expect(hashRepoDoc("media", "---", [Buffer.from("b")])).not.toBe(base)
  })
})
