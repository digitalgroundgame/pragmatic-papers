import { describe, expect, it } from "vitest"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"

const svg = (path: string) => `<svg viewBox="0 0 10 10"><g><path d="M0 0" ${path}/></g></svg>`

describe("resolveInlineSvgMap", () => {
  it("sanitizes the SVG and surfaces the parsed paths", () => {
    const result = resolveInlineSvgMap({
      title: "Missouri",
      svg: `${svg('data-region="MO-01"')}<script>bad()</script>`,
      regionAttribute: "data-region",
      regions: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.viewBox).toBe("0 0 10 10")
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0]?.regionId).toBe("MO-01")
  })

  it("computes resolved regions with formatted values and colors from the diverging scale", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('data-region="MO-01"'),
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
      svg: svg('data-region="MO-03"'),
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

  it("defaults the region attribute to data-region when blank", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('data-region="X"'),
      regionAttribute: "",
      regions: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.paths[0]?.regionId).toBe("X")
  })

  it("uses a custom region attribute (e.g. data-district)", () => {
    const result = resolveInlineSvgMap({
      title: null,
      svg: svg('data-district="01"'),
      regionAttribute: "data-district",
      regions: [],
      scaleType: "divergingRedBlue",
    })
    expect(result.paths[0]?.regionId).toBe("01")
  })
})
