import { describe, expect, it } from "vitest"

import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"

const DEFAULT_IMAGES = [
  {
    url: expect.stringMatching(/\/the-pragmatic-papers-opengraph-image\.png$/),
    alt: expect.stringContaining("The Pragmatic Papers"),
  },
]

describe("mergeOpenGraph", () => {
  it("falls back to the site defaults", () => {
    expect(mergeOpenGraph()).toEqual({
      type: "website",
      description: expect.stringContaining("community-driven"),
      images: DEFAULT_IMAGES,
      siteName: "The Pragmatic Papers",
      title: "The Pragmatic Papers",
    })
  })

  it("overrides the defaults it is given and keeps the rest", () => {
    expect(mergeOpenGraph({ title: "Authors", description: "Who writes here" })).toEqual({
      type: "website",
      description: "Who writes here",
      images: DEFAULT_IMAGES,
      siteName: "The Pragmatic Papers",
      title: "Authors",
    })
  })

  it("uses the given images in place of the default image", () => {
    const images = [{ url: "https://example.com/cover.png", alt: "Cover" }]

    expect(mergeOpenGraph({ images })?.images).toBe(images)
  })

  it("keeps the default image when images is left unset", () => {
    expect(mergeOpenGraph({ title: "Topics", images: undefined })?.images).toEqual(DEFAULT_IMAGES)
  })

  it("keeps the default image when given an empty images list", () => {
    expect(mergeOpenGraph({ title: "Topics", images: [] })?.images).toEqual(DEFAULT_IMAGES)
  })

  it.each([
    ["a single image object", { url: "https://example.com/cover.png", alt: "Cover" }],
    ["a single image URL", "https://example.com/cover.png"],
  ])("passes %s through unchanged", (_, image) => {
    expect(mergeOpenGraph({ images: image })?.images).toBe(image)
  })
})
