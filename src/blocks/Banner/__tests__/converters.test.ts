// @vitest-environment node
import { describe, expect, it } from "vitest"

import { bannerBlock } from "@/stories/fixtures/blocks"
import { feedContext } from "@/stories/fixtures/feedContext"

import { bannerToHTML } from "../converters"

describe("bannerToHTML", () => {
  it("renders the banner's rich text in a plain blockquote", () => {
    expect(bannerToHTML(bannerBlock, feedContext())).toMatchInlineSnapshot(
      `"<blockquote><p><strong>Correction: </strong>an earlier version of this article misstated the turnout in 2022.</p></blockquote>"`,
    )
  })
})
