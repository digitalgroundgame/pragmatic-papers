import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { regionGlyph } from "@/interactives/engine/icons"

const region = (id: string, facts: Record<string, string>, layer: string | null = "circuit") => ({
  id,
  layer,
  facts,
})

describe("regionGlyph", () => {
  const icons = { byRegion: { scotus: "landmark" }, byLayer: { circuit: "scale" }, shortFact: "s" }

  it("draws a numbered region as its own numeral", () => {
    const { container } = render(<>{regionGlyph(region("ca9", { s: "9th" }), icons)}</>)
    expect(container).toHaveTextContent("IX")
    // Not the scale its layer would otherwise have given it: thirteen of those in a folded
    // rail say only "circuit", which the reader can see.
    expect(container.querySelector("svg")).toBeNull()
  })

  it("keeps a short form that is not a number", () => {
    const { container } = render(<>{regionGlyph(region("cadc", { s: "DC" }), icons)}</>)
    expect(container).toHaveTextContent("DC")
  })

  it("falls back to the icon when the short form is too long to draw", () => {
    const { container } = render(<>{regionGlyph(region("scotus", { s: "SCOTUS" }, null), icons)}</>)
    expect(container).toHaveTextContent("")
    expect(container.querySelector("svg")).toHaveClass("lucide-landmark")
  })

  it("gives nothing when the profile names no fact and no icon", () => {
    const { container } = render(<>{regionGlyph(region("w1", {}, null), {})}</>)
    expect(container).toBeEmptyDOMElement()
  })
})
