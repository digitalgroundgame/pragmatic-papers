/** @jsxImportSource @/blocks/blockImages/svg */
import { describe, expect, it } from "vitest"

import { Fragment, jsx, Markup } from "../jsx-runtime"

const Dot = ({ r }: { r: number }): Markup => <circle r={r} fill="red" />

describe("the SVG string JSX runtime", () => {
  it("writes elements with SVG's kebab-case attributes, keeping viewBox", () => {
    expect(String(<svg viewBox="0 0 2 2" strokeWidth={2} className="x" />)).toBe(
      '<svg viewBox="0 0 2 2" stroke-width="2" class="x"></svg>',
    )
  })

  it("renders components, fragments and lists, dropping keys and empty values", () => {
    const out = (
      <g>
        <>
          {[1, 2].map((r) => (
            <Dot key={r} r={r} />
          ))}
        </>
        {false}
        {null}
        <rect x={undefined} />
      </g>
    )
    expect(String(out)).toBe(
      '<g><circle r="1" fill="red"></circle><circle r="2" fill="red"></circle><rect></rect></g>',
    )
  })

  it("escapes text and attribute values, but nests its own markup as is", () => {
    expect(String(<text title='"a" & <b>'>{"x < y & 'z'"}</text>)).toBe(
      '<text title="&quot;a&quot; &amp; &lt;b&gt;">x &lt; y &amp; &#x27;z&#x27;</text>',
    )
    expect(String(jsx(Fragment, { children: [new Markup("<b></b>"), "<i>"] }))).toBe(
      "<b></b>&lt;i&gt;",
    )
  })
})
