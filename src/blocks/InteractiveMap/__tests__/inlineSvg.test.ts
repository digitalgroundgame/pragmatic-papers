import { describe, expect, it } from "vitest"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"

const svg = (path: string) => `<svg viewBox="0 0 10 10"><g><path d="M0 0" ${path}/></g></svg>`

describe("resolveInlineSvgMap", () => {
  it("sanitizes the SVG and surfaces the parsed paths", () => {
    const result = resolveInlineSvgMap({
      title: "Missouri",
      svg: `${svg('id="MO-01"')}<script>bad()</script>`,
      overrides: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.viewBox).toBe("0 0 10 10")
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0]?.regionId).toBe("MO-01")
  })

  it("computes resolved regions from paths, using manual region entries as overrides", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('id="MO-01"'),
      dataAttribute: "data-margin",
      overrides: [
        { regionId: "MO-01", label: "District 1", value: 12.5 },
        { regionId: "MO-02", label: "District 2", value: -3.1 }, // no path — excluded
      ],
      scaleType: "divergingRedBlue",
    })

    expect(result.regions).toEqual([
      {
        regionId: "MO-01",
        label: "District 1",
        formattedValue: "R+12.5",
        color: "var(--map-positive-3, #f08c9d)",
      },
    ])
  })

  it("derives value from dataAttribute on the SVG path when no region override is provided", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('id="MO-01" data-margin="-58.18"'),
      dataAttribute: "data-margin",

      overrides: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.regions[0]).toMatchObject({
      regionId: "MO-01",
      label: "MO-01",
      formattedValue: "D+58.2",
    })
  })

  it("manual region value overrides the SVG-derived value", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('id="MO-01" data-margin="-58.18"'),
      dataAttribute: "data-margin",

      overrides: [{ regionId: "MO-01", label: "District 1", value: 20 }],
      scaleType: "divergingRedBlue",
    })
    expect(result.regions[0]?.formattedValue).toBe("R+20.0")
  })

  it("infers percent format from data-percent attribute name", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('id="MO-01" data-percent="63.4"'),
      dataAttribute: "data-percent",
      overrides: [],
      scaleType: "perRegion",
    })
    expect(result.regions[0]?.formattedValue).toBe("63.4%")
  })

  it("produces no formatted value when no dataAttribute is configured", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('id="MO-01"'),
      overrides: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.regions[0]?.formattedValue).toBeNull()
  })

  it("falls back to regionId when label is missing and respects override colors", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('id="MO-03"'),
      dataAttribute: "data-margin",
      overrides: [{ regionId: "MO-03", label: null, value: 5, color: "#ff00ff" }],
      scaleType: "divergingRedBlue",
    })

    expect(result.regions[0]).toEqual({
      regionId: "MO-03",
      label: "MO-03",
      formattedValue: "R+5.0",
      color: "#ff00ff",
    })
  })

  it("reads regionId from id attribute", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('id="X"'),
      overrides: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.paths[0]?.regionId).toBe("X")
  })
})
