// @vitest-environment node
import { describe, expect, it } from "vitest"

import { displayMathBlock, inlineMathBlock } from "@/stories/fixtures/blocks"

import {
  displayMathToCode,
  displayMathToHTML,
  inlineMathToCode,
  inlineMathToHTML,
} from "../converters"

describe("math converters", () => {
  it("renders display math in MathJax delimiters", () => {
    expect(displayMathToHTML(displayMathBlock)).toMatchInlineSnapshot(
      `"<p class="math display-math">\\[a^2 + b^2 = c^2\\]</p>"`,
    )
  })

  it("renders inline math in MathJax delimiters", () => {
    expect(inlineMathToHTML(inlineMathBlock)).toMatchInlineSnapshot(
      `"<span class="math">\\(E = mc^2\\)</span>"`,
    )
  })

  it("renders display math as its LaTeX source in a code block", () => {
    expect(displayMathToCode(displayMathBlock)).toMatchInlineSnapshot(
      `"<pre><code>a^2 + b^2 = c^2</code></pre>"`,
    )
  })

  it("renders inline math as its LaTeX source in inline code", () => {
    expect(inlineMathToCode(inlineMathBlock)).toMatchInlineSnapshot(`"<code>E = mc^2</code>"`)
  })

  it("escapes the LaTeX", () => {
    expect(displayMathToHTML({ math: "a<b & c" })).toMatchInlineSnapshot(
      `"<p class="math display-math">\\[a&lt;b &amp; c\\]</p>"`,
    )
    expect(inlineMathToCode({ math: "a<b" })).toMatchInlineSnapshot(`"<code>a&lt;b</code>"`)
  })

  it("renders nothing for empty math", () => {
    expect(
      [displayMathToHTML, inlineMathToHTML, displayMathToCode, inlineMathToCode].map((toHTML) =>
        toHTML({ math: "" }),
      ),
    ).toEqual(["", "", "", ""])
  })
})
