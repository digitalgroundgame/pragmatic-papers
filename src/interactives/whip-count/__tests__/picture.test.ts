import { describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import { drawWhipCountSVG } from "../picture"

describe("drawWhipCountSVG", () => {
  const svg = drawWhipCountSVG({ title: "Who leads <the> caucus?", data: whipCountData })

  it("draws the title, the totals, the majority and the legend", () => {
    expect(svg).toContain("Who leads &lt;the&gt; caucus?")
    expect(svg).toContain("AS OF NOVEMBER 13, 2026")
    expect(svg).toContain(">Back Hale<")
    expect(svg).toContain(">Back Ortiz<")
    expect(svg).toContain(">plus 1 leaning<")
    expect(svg).toContain(">5 to win<")
    expect(svg).toContain(">3 Backs Hale<")
    expect(svg).toContain(">1 Won’t back Hale<")
  })

  it("draws one rectangle a voter, in plain colors", () => {
    // Nine voters' rectangles, six legend swatches, two candidate swatches, the line and the
    // background.
    expect(svg.match(/<rect /g)).toHaveLength(9 + 6 + 2 + 1 + 1)
    expect(svg).not.toContain("var(")
    expect(svg).toContain('fill="#155dfc"')
    // Ruling a candidate out is pale yellow with a hairline, not a tint of the other's color.
    expect(svg).toContain('fill="#f3efe8" stroke="#525252" stroke-width="1"')
    expect(svg).not.toContain('fill="#e2330f" fill-opacity')
  })

  it("puts the logo in the bottom right corner", () => {
    const logo = '<svg viewBox="0 0 200 20" class="h-4"><path d="M0 0h200v20H0z"/></svg>'
    const withLogo = drawWhipCountSVG({ title: "T", data: whipCountData, logo })
    // 22 tall, so 220 wide, ending 56 from the right edge of 1200.
    expect(withLogo).toContain('<svg x="924" ')
    expect(withLogo).toContain('width="220" height="22" viewBox="0 0 200 20"')
    expect(svg).not.toContain("<svg x=")
  })

  it("draws in the palette it is given, and inlines the fonts", () => {
    const dark = drawWhipCountSVG({
      title: "T",
      data: whipCountData,
      palette: { background: "#000", ink: "#fff", quietInk: "#aaa", color: () => "rgb(1, 2, 3)" },
      fontFaces: "@font-face{font-family:Geist}",
    })
    expect(dark).toContain('<rect width="1200"')
    expect(dark).toContain('fill="#000"')
    expect(dark).toContain('fill="rgb(1, 2, 3)"')
    expect(dark).toContain("<style>@font-face{font-family:Geist}</style>")
  })
})
