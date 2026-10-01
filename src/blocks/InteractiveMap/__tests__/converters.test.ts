// @vitest-environment node
import { describe, expect, it } from "vitest"

import { interactiveMapBlock } from "@/stories/fixtures/blocks"
import { feedContext } from "@/stories/fixtures/feedContext"

import { interactiveMapToHTML } from "../converters"

describe("interactiveMapToHTML", () => {
  it("links back to the page the map sits on, naming the map", () => {
    expect(interactiveMapToHTML(interactiveMapBlock, feedContext())).toMatchInlineSnapshot(
      `"<p><a href="https://example.org/articles/example-article">View the interactive map “Missouri congressional districts” on The Pragmatic Papers →</a></p>"`,
    )
  })

  it("leaves the title out when the map has none", () => {
    expect(interactiveMapToHTML({ widgetTitle: null }, feedContext())).toMatchInlineSnapshot(
      `"<p><a href="https://example.org/articles/example-article">View the interactive map on The Pragmatic Papers →</a></p>"`,
    )
  })

  it("escapes the title", () => {
    expect(interactiveMapToHTML({ widgetTitle: "R&D <maps>" }, feedContext())).toContain(
      "“R&amp;D &lt;maps&gt;”",
    )
  })
})
