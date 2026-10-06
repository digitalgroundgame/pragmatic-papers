// @vitest-environment node
import { describe, expect, it } from "vitest"

import { socialEmbedBlock } from "@/stories/fixtures/blocks"

import { socialEmbedToHTML } from "../converters"

describe("socialEmbedToHTML", () => {
  it("links to the post on its platform", () => {
    expect(socialEmbedToHTML(socialEmbedBlock)).toMatchInlineSnapshot(
      `"<blockquote><p><a href="https://twitter.com/countyclerk/status/1">View post on Twitter</a></p></blockquote>"`,
    )
  })

  it("names an unknown platform generically", () => {
    expect(
      socialEmbedToHTML({ url: "https://myspace.com/example", platform: "myspace" as never }),
    ).toMatchInlineSnapshot(
      `"<blockquote><p><a href="https://myspace.com/example">View the post</a></p></blockquote>"`,
    )
  })

  it("escapes the URL", () => {
    expect(
      socialEmbedToHTML({ url: 'https://x.test/"onmouseover=', platform: "twitter" }),
    ).toContain('href="https://x.test/&quot;onmouseover="')
  })

  it("renders nothing without a URL", () => {
    expect(socialEmbedToHTML({ url: "", platform: "twitter" })).toBe("")
  })
})
