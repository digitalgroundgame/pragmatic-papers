import { describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import { drawWhipCountSVG } from "../picture"

describe("drawWhipCountSVG", () => {
  const svg = drawWhipCountSVG({ title: "Who leads <the> caucus?", data: whipCountData })

  it("draws the title, the totals head to head, the majority and the legend", () => {
    expect(svg).toContain("Who leads &lt;the&gt; caucus?")
    // The site's eyebrow, in its serif and the brand's text colour.
    expect(svg).toMatch(
      /Libertinus Serif[^>]*fill="#e0330f"[^>]*>WHIP COUNT · AS OF NOVEMBER 13, 2026</,
    )
    expect(svg).toMatch(/text-anchor="start">Marion Hale</)
    expect(svg).toMatch(/text-anchor="end">Daniel Ortiz</)
    expect(svg).toContain(">backing, plus 1 leaning<")
    expect(svg).toContain(">vs<")
    // Ortiz's forecast, lighter and inward of his count, with what it means.
    expect(svg).toMatch(/font-size="64"[^>]*fill="#525252"[^>]*>3</)
    expect(svg).toContain(">3 if the 1 who won’t back Hale hold to it<")
    expect(svg).toContain(">5 to win<")
    expect(svg).toContain(">3 Backs Hale<")
    expect(svg).toContain(">1 Won’t back Hale<")
  })

  it("leaves out the list of votes and any reader's own count", () => {
    const candidates = new Set(whipCountData.candidates.map((c) => c.name))
    for (const member of whipCountData.members) {
      if (!candidates.has(member.name)) expect(svg).not.toContain(member.name)
    }
    expect(svg).not.toMatch(/your count|your pick|every vote/i)
  })

  it("draws one rectangle a voter, in plain colors", () => {
    // Nine voters' rectangles, six legend swatches, two candidate swatches, the line and the
    // background.
    expect(svg.match(/<rect /g)).toHaveLength(9 + 6 + 2 + 1 + 1)
    expect(svg).not.toContain("var(")
    expect(svg).toContain('fill="#155dfc"')
    // Ruling a candidate out is amber, not a tint of the other candidate's color.
    expect(svg).toContain('fill="#d78e00"')
    expect(svg).not.toContain('fill="#e2330f" fill-opacity')
  })

  it("puts the logo top left, as the link preview does, with the date across from it", () => {
    const logo = '<svg viewBox="0 0 200 20" class="h-4"><path d="M0 0h200v20H0z"/></svg>'
    const withLogo = drawWhipCountSVG({ title: "T", data: whipCountData, logo })
    // 30 tall, so 300 wide, 56 in from the top left.
    expect(withLogo).toContain('<svg x="56" y="56" width="300" height="30" viewBox="0 0 200 20"')
    expect(withLogo).toMatch(/x="1144"[^>]*text-anchor="end">WHIP COUNT/)
    expect(svg).not.toContain("<svg x=")
  })

  it("counts down to the vote in an ink badge when it knows the time", () => {
    const data = { ...whipCountData, voteAt: "2026-12-01T09:30:00-05:00" }
    const counting = drawWhipCountSVG({ title: "T", data, now: new Date("2026-11-14T15:00:00Z") })
    expect(counting).toContain(">17 days to the vote<")
    expect(counting).toMatch(/fill="#171717"\/><text[^>]*fill="#ffffff"[^>]*>17 days to the vote</)
    expect(drawWhipCountSVG({ title: "T", data })).not.toContain("to the vote")
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
