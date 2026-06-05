import { describe, expect, it } from "vitest"

import { parseInlineSvg } from "@/blocks/InteractiveMap/parseInlineSvg"

describe("parseInlineSvg", () => {
  it("extracts viewBox, transform, and path data", () => {
    const svg = `<svg viewBox="0 0 100 100"><g transform="scale(1,-1) translate(0,-100)"><path d="M0 0H10V10H0Z" id="MO-01"/><path d="M10 0H20V10H10Z" id="MO-02"/></g></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.viewBox).toBe("0 0 100 100")
    expect(result.transform).toBe("scale(1,-1) translate(0,-100)")
    expect(result.paths).toEqual([
      { d: "M0 0H10V10H0Z", regionId: "MO-01", value: null, extraAttrs: {} },
      { d: "M10 0H20V10H10Z", regionId: "MO-02", value: null, extraAttrs: {} },
    ])
  })

  it("handles SVG without a wrapping group", () => {
    const svg = `<svg viewBox="0 0 10 10"><path d="M0 0" id="A"/></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.transform).toBeNull()
    expect(result.paths).toHaveLength(1)
  })

  it("uses a writer-specified region attribute (e.g. data-district)", () => {
    const svg = `<svg viewBox="0 0 1 1"><path d="M0 0" data-district="01"/></svg>`
    const result = parseInlineSvg(svg, "data-district")
    expect(result.paths[0]?.regionId).toBe("01")
  })

  it("returns null regionId for paths missing the join attribute", () => {
    const svg = `<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.paths[0]?.regionId).toBeNull()
  })

  it("skips paths without a d attribute", () => {
    const svg = `<svg viewBox="0 0 1 1"><path id="A"/><path d="M0 0" id="B"/></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0]?.regionId).toBe("B")
  })

  it("captures extra path attributes the renderer might want to forward", () => {
    const svg = `<svg viewBox="0 0 1 1"><path d="M0 0" id="A" class="hi"/></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.paths[0]?.extraAttrs).toEqual({ class: "hi" })
  })

  it("only records the first <g> transform but still collects paths from later groups", () => {
    const svg = `<svg viewBox="0 0 10 10"><g transform="scale(1)"><path d="M0 0" id="A"/></g><g transform="ignored"><path d="M1 1" id="B"/></g></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.transform).toBe("scale(1)")
    expect(result.paths.map((p) => p.regionId)).toEqual(["A", "B"])
  })

  it("ignores viewBox on a nested <svg> element", () => {
    const svg = `<svg viewBox="0 0 100 100"><svg viewBox="9 9 9 9"><path d="M0 0" id="A"/></svg></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.viewBox).toBe("0 0 100 100")
    expect(result.paths).toHaveLength(1)
  })


  it("extracts numeric value from dataAttribute and excludes it from extraAttrs", () => {
    const svg = `<svg viewBox="0 0 1 1"><path d="M0 0" id="A" data-margin="-58.18"/></svg>`
    const result = parseInlineSvg(svg, "id", "data-margin")
    expect(result.paths[0]?.value).toBe(-58.18)
    expect(result.paths[0]?.extraAttrs).toEqual({})
  })

  it("sets value to null when dataAttribute is absent from the path", () => {
    const svg = `<svg viewBox="0 0 1 1"><path d="M0 0" id="A"/></svg>`
    const result = parseInlineSvg(svg, "id", "data-margin")
    expect(result.paths[0]?.value).toBeNull()
  })

  it("sets value to null when no dataAttribute is configured", () => {
    const svg = `<svg viewBox="0 0 1 1"><path d="M0 0" id="A" data-margin="12"/></svg>`
    const result = parseInlineSvg(svg, "id")
    expect(result.paths[0]?.value).toBeNull()
    expect(result.paths[0]?.extraAttrs).toEqual({ "data-margin": "12" })
  })
})
