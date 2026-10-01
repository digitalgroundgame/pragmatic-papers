// @vitest-environment node
import { describe, expect, it } from "vitest"

import { mediaCollageBlock } from "@/stories/fixtures/blocks"
import { feedContext } from "@/stories/fixtures/feedContext"

import { mediaCollageToHTML } from "../converters"

describe("mediaCollageToHTML", () => {
  it("renders one figure per image, in order", () => {
    expect(mediaCollageToHTML(mediaCollageBlock, feedContext())).toMatchInlineSnapshot(
      `"<figure><img src="https://example.org/storybook-assets/landscape.svg" alt="Mountains at sunset" width="1600" height="900" /><figcaption><p>The ridge above town at dusk. Photo: <a href="https://example.com/archive">County Archive</a></p></figcaption></figure><figure><img src="https://example.org/storybook-assets/square.svg" alt="Portrait of a writer" width="800" height="800" /></figure><figure><img src="https://example.org/storybook-assets/portrait.svg" alt="A printed page on a green desk" width="800" height="1200" /></figure><figure><img src="https://example.org/storybook-assets/wide.svg" alt="A city skyline at dusk" width="1920" height="400" /></figure>"`,
    )
  })

  it("skips images that weren't loaded", () => {
    expect(mediaCollageToHTML({ images: [{ media: 4 }] }, feedContext())).toBe("")
  })
})
