// @vitest-environment node
import { describe, expect, it } from "vitest"

import { footnoteBlock, footnotes } from "@/stories/fixtures/blocks"
import { feedContext } from "@/stories/fixtures/feedContext"

import { footnotesToHTML, footnoteToHTML } from "../converters"

describe("footnoteToHTML", () => {
  it("renders a plain [n] marker without an anchor", () => {
    expect(footnoteToHTML(footnoteBlock)).toMatchInlineSnapshot(`"<sup>[3]</sup>"`)
  })

  it("renders nothing for a footnote without an index", () => {
    expect(footnoteToHTML({ index: null })).toBe("")
  })
})

describe("footnotesToHTML", () => {
  it("lists the notes in index order under a Notes heading, with their sources", () => {
    expect(footnotesToHTML(footnotes, feedContext())).toMatchInlineSnapshot(
      `"<hr /><h3>Notes</h3><p>[1] Registration counts as of the close of books.</p><p>[3] Turnout figures are from the county clerk&#39;s certified results. <a href="https://example.com/certified-results">County Clerk</a></p>"`,
    )
  })

  it("makes a source that references a site page absolute, labelled by its URL", () => {
    expect(
      footnotesToHTML(
        [
          {
            index: 1,
            note: "See our explainer.",
            attributionEnabled: true,
            link: {
              type: "reference",
              reference: { relationTo: "articles", value: { slug: "explainer" } as never },
            },
          },
        ],
        feedContext(),
      ),
    ).toMatchInlineSnapshot(
      `"<hr /><h3>Notes</h3><p>[1] See our explainer. <a href="https://example.org/articles/explainer">https://example.org/articles/explainer</a></p>"`,
    )
  })

  it("escapes the note and its source", () => {
    expect(
      footnotesToHTML(
        [
          {
            index: 1,
            note: 'Tom & "Jerry" <3',
            attributionEnabled: true,
            link: { type: "custom", url: "https://x.test/?a=1&b=2", label: "<Source>" },
          },
        ],
        feedContext(),
      ),
    ).toMatchInlineSnapshot(
      `"<hr /><h3>Notes</h3><p>[1] Tom &amp; &quot;Jerry&quot; &lt;3 <a href="https://x.test/?a=1&amp;b=2">&lt;Source&gt;</a></p>"`,
    )
  })

  it("leaves out the source when attribution is off", () => {
    expect(
      footnotesToHTML(
        [
          {
            index: 1,
            note: "No source shown.",
            attributionEnabled: false,
            link: { type: "custom", url: "https://x.test" },
          },
        ],
        feedContext(),
      ),
    ).not.toContain("<a ")
  })

  it("renders nothing without notes", () => {
    expect(footnotesToHTML([], feedContext())).toBe("")
    expect(footnotesToHTML(undefined, feedContext())).toBe("")
  })
})
