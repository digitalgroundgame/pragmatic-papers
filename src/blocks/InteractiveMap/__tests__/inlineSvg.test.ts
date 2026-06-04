import { describe, expect, it } from "vitest"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"

describe("resolveInlineSvgMap", () => {
  const baseSvg = `<svg viewBox="0 0 10 10"><path d="M0 0" data-region="MO-01"/></svg>`

  it("sanitizes the SVG and preserves region attributes", () => {
    const result = resolveInlineSvgMap({
      title: "Missouri",
      svg: `${baseSvg}<script>bad()</script>`,
      regionAttribute: "data-region",
      regions: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.svg).not.toContain("<script")
    expect(result.svg).toContain('data-region="MO-01"')
  })

  it("computes resolved regions with formatted values and colors from the diverging scale", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: baseSvg,
      regionAttribute: "data-region",
      regions: [
        { regionId: "MO-01", label: "District 1", value: 12.5 },
        { regionId: "MO-02", label: "District 2", value: -3.1 },
      ],
      scaleType: "divergingRedBlue",
    })

    expect(result.regions).toEqual([
      {
        regionId: "MO-01",
        label: "District 1",
        formattedValue: "R+12.5",
        color: "#fd5864",
      },
      {
        regionId: "MO-02",
        label: "District 2",
        formattedValue: "D+3.1",
        color: "#89aefd",
      },
    ])
  })

  it("falls back to regionId when label is missing and respects override colors", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: baseSvg,
      regionAttribute: "data-region",
      regions: [{ regionId: "MO-03", label: null, value: 5, color: "#ff00ff" }],
      scaleType: "divergingRedBlue",
    })

    expect(result.regions[0]).toEqual({
      regionId: "MO-03",
      label: "MO-03",
      formattedValue: "R+5.0",
      color: "#ff00ff",
    })
  })

  it("defaults regionAttribute to data-region when blank", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: baseSvg,
      regionAttribute: "",
      regions: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.regionAttribute).toBe("data-region")
  })
})
