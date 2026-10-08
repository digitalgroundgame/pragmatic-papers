// @vitest-environment node
import { describe, expect, it } from "vitest"

import { captionedImage } from "@/stories/fixtures/blocks"
import { feedContext } from "@/stories/fixtures/feedContext"
import { landscapeImage, loopVideo } from "@/stories/fixtures/media"

import { mediaBlockToHTML, mediaToFigure } from "../converters"

describe("mediaBlockToHTML", () => {
  it("renders an image as a figure with an absolute src, alt text and size", () => {
    expect(mediaBlockToHTML({ media: landscapeImage }, feedContext())).toMatchInlineSnapshot(
      `"<figure><img src="https://example.org/storybook-assets/landscape.svg" alt="Mountains at sunset" width="1600" height="900" /></figure>"`,
    )
  })

  it("adds the caption as a figcaption", () => {
    expect(mediaBlockToHTML({ media: captionedImage }, feedContext())).toMatchInlineSnapshot(
      `"<figure><img src="https://example.org/storybook-assets/landscape.svg" alt="Mountains at sunset" width="1600" height="900" /><figcaption><p>The ridge above town at dusk. Photo: <a href="https://example.com/archive">County Archive</a></p></figcaption></figure>"`,
    )
  })

  it("links to a video instead of embedding it", () => {
    expect(mediaBlockToHTML({ media: loopVideo }, feedContext())).toMatchInlineSnapshot(
      `"<figure><a href="https://example.org/storybook-assets/loop.webm">A square sliding across a navy background</a></figure>"`,
    )
  })
})

describe("mediaToFigure", () => {
  it("keeps an already-absolute URL", () => {
    expect(
      mediaToFigure({ ...landscapeImage, url: "https://cdn.test/a.svg" }, feedContext()),
    ).toContain('src="https://cdn.test/a.svg"')
  })

  it("escapes the alt text", () => {
    expect(mediaToFigure({ ...landscapeImage, alt: 'A "quoted" <alt>' }, feedContext())).toContain(
      'alt="A &quot;quoted&quot; &lt;alt&gt;"',
    )
  })

  it("renders nothing for media that wasn't loaded or has no file", () => {
    expect(mediaToFigure(7, feedContext())).toBe("")
    expect(mediaToFigure(null, feedContext())).toBe("")
    expect(mediaToFigure({ ...landscapeImage, url: null }, feedContext())).toBe("")
  })
})
