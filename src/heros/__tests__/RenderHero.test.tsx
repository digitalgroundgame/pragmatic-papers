import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Page } from "@/payload-types"

import { homeStatic } from "@/endpoints/seed/home-static"

import { RenderHero, hasH1 } from "../RenderHero"

// The heroes render rich text, which is server-only; stand-ins say which one rendered.
vi.mock("@/heros/HighImpact", () => ({ HighImpactHero: () => <div>high</div> }))
vi.mock("@/heros/MediumImpact", () => ({ MediumImpactHero: () => <div>medium</div> }))
vi.mock("@/heros/PageHero", () => ({ PageHero: () => <div>page</div> }))
vi.mock("@/heros/LowImpact", () => ({
  LowImpactHero: ({ richText }: Page["hero"]) =>
    hasH1(richText) ? <h1>Hero heading</h1> : <h2>Hero heading</h2>,
}))

afterEach(cleanup)

const richText = (tag: "h1" | "h2"): NonNullable<Page["hero"]["richText"]> => ({
  root: {
    type: "root",
    direction: "ltr",
    format: "",
    indent: 0,
    version: 1,
    children: [
      {
        type: "heading",
        tag,
        direction: "ltr",
        format: "",
        indent: 0,
        version: 1,
        children: [{ type: "text", text: "Hero heading", version: 1 }],
      },
    ],
  },
})

describe("hasH1", () => {
  it("finds a top-level h1 heading", () => {
    expect(hasH1(richText("h1"))).toBe(true)
  })

  it("is false for other headings and for no rich text", () => {
    expect(hasH1(richText("h2"))).toBe(false)
    expect(hasH1(null)).toBe(false)
  })
})

describe("RenderHero", () => {
  it("gives a page with no hero a visually hidden h1 of its title", () => {
    render(<RenderHero type="none" title="The Pragmatic Papers" />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1).toHaveTextContent("The Pragmatic Papers")
    expect(h1).toHaveClass("sr-only")
  })

  it("adds the hidden h1 when the hero's rich text has none", () => {
    render(<RenderHero type="lowImpact" richText={richText("h2")} title="About" />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("About")
  })

  it("leaves a hero that opens with its own h1 alone", () => {
    render(<RenderHero type="lowImpact" richText={richText("h1")} title="About" />)
    const h1s = screen.getAllByRole("heading", { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).not.toHaveClass("sr-only")
  })

  it("renders nothing without a hero or a title", () => {
    const { container } = render(<RenderHero type="none" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("the unseeded home page's hero", () => {
  it("has no h1, since the home page renders its own", () => {
    expect(hasH1(homeStatic.hero.richText)).toBe(false)
  })
})
