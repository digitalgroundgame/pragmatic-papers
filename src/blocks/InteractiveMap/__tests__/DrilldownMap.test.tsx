import { cleanup, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { InteractiveMapBlock } from "@/blocks/InteractiveMap/InteractiveMapBlock"
import type { MapAsset } from "@/payload-types"

const asset = (id: number, filename: string, svgContent: string | null): MapAsset => ({
  id,
  svgContent,
  filename,
  url: `/map-assets/${filename}`,
  mimeType: "image/svg+xml",
  updatedAt: "2025-01-01T00:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
})

const overviewSvg = `<svg viewBox="0 0 100 50">
  <metadata>{"schema":"pragmatic-papers/drilldown-map@1","regions":[{"id":"fed","label":"Federal (no geometry)"}],"facts":{"labels":{"seats":"Authorized"}}}</metadata>
  <g transform="scale(1,-1) translate(0,-50)">
    <path id="west" data-region-label="West" data-order="2" data-seats="9" data-summary="9 authorized" d="M0 0L50 0L50 50L0 50Z"/>
    <path id="east" data-region-label="East" data-order="1" data-seats="4" d="M50 0L100 0L100 50L50 50Z"/>
    <path id="w1" data-parent-id="west" data-region-label="West 1" d="M0 0L25 0L25 50L0 50Z"/>
    <path id="ak" data-parent-id="west" data-inset="true" data-region-label="Alaska" d="M5 5L10 5L10 10Z"/>
    <path d="M50 0L50 50" stroke="red"/>
  </g>
</svg>`

function renderDrilldown(overrides: Record<string, unknown> = {}) {
  return render(
    <InteractiveMapBlock
      blockType="interactiveMap"
      mode="drilldown"
      widgetTitle="Courts"
      drilldown={{
        overviewAsset: asset(1, "national.svg", overviewSvg),
        regionAssets: [
          { regionId: "west", svgAsset: asset(2, "west.svg", "<svg/>") },
          { regionId: "east", svgAsset: asset(3, "east file.svg", "<svg/>") },
          { regionId: "nowhere", svgAsset: asset(4, "x.svg", "<svg/>") },
        ],
      }}
      sources={[
        {
          link: {
            type: "custom",
            url: "https://fjc.gov",
            label: "FJC",
            newTab: true,
            variant: "link",
          },
        },
      ]}
      {...overrides}
    />,
  )
}

describe("InteractiveMapBlock — drilldown mode (server render)", () => {
  afterEach(cleanup)

  it("renders the overview geometry with roles, the region list and facts, without any child data", () => {
    const { container } = renderDrilldown()
    const figure = container.querySelector("[data-interactive-map-block]")!
    expect(figure).toHaveAttribute("data-map-mode", "drilldown")
    expect(within(figure as HTMLElement).getByText("Courts")).toBeInTheDocument()

    const svg = container.querySelector("svg[data-drilldown-overview]")!
    // 3% padding on each side of a 100×50 box
    expect(svg).toHaveAttribute("viewBox", "-3 -3 106 56")
    expect(container.querySelector("[data-drilldown-shapes]")).toHaveAttribute(
      "transform",
      "scale(1,-1) translate(0, -50)",
    )

    const roles = Array.from(svg.querySelectorAll("path")).map((p) => p.getAttribute("data-role"))
    expect(roles).toEqual([
      "parent",
      "parent",
      "child",
      "child",
      "decorative",
      "outline",
      "outline",
    ])

    const west = container.querySelector('path[data-region-id="west"][data-role="parent"]')!
    expect(west).toHaveAttribute("role", "button")
    expect(west).toHaveAttribute("tabindex", "0")
    expect(west).toHaveAttribute("aria-label", "West")

    // an inset child is interactive on the overview; a mainland child is not
    expect(container.querySelector('path[data-region-id="ak"]')).toHaveAttribute("tabindex", "0")
    expect(container.querySelector('path[data-region-id="w1"]')).not.toHaveAttribute("tabindex")

    // region list: ordered by data-order, declared geometry-less region included, facts labelled
    const items = Array.from(container.querySelectorAll("[data-region-item]")).map((el) =>
      el.getAttribute("data-region-item"),
    )
    expect(items).toEqual(["east", "west", "fed"])
    const westItem = container.querySelector('[data-region-item="west"]')!
    expect(westItem).toHaveAttribute("data-drillable", "true")
    expect(within(westItem as HTMLElement).getByText("9 authorized")).toBeInTheDocument()
    expect(within(westItem as HTMLElement).getByText("Authorized")).toBeInTheDocument()
    expect(container.querySelector('[data-region-item="fed"]')).not.toHaveAttribute(
      "data-drillable",
    )

    // nothing from the child assets is in the HTML
    expect(container.innerHTML).not.toContain("<svg/>")
  })

  it("emits a same-origin prefetch link per valid child asset, in a crawler-discoverable form", () => {
    renderDrilldown()
    // React 19 hoists <link> elements into <head>, which is also where a crawler expects them.
    const links = Array.from(document.head.querySelectorAll('link[rel="prefetch"]'))
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/map-assets/west.svg",
      "/map-assets/east%20file.svg",
    ])
    for (const l of links) expect(l).toHaveAttribute("as", "fetch")
  })

  it("renders the sources footer", () => {
    const { getByText } = renderDrilldown()
    expect(getByText("FJC")).toHaveAttribute("href", "https://fjc.gov")
  })

  it("renders nothing when the overview asset is unpopulated or has no content", () => {
    expect(
      renderDrilldown({ drilldown: { overviewAsset: 7, regionAssets: [] } }).container,
    ).toBeEmptyDOMElement()
    expect(
      renderDrilldown({ drilldown: { overviewAsset: asset(1, "n.svg", null), regionAssets: [] } })
        .container,
    ).toBeEmptyDOMElement()
  })

  it("still renders the choropleth when mode is unset (content saved before the field existed)", () => {
    const { container } = render(
      <InteractiveMapBlock
        blockType="interactiveMap"
        layout="row"
        colorScale="divergingRedBlue"
        maps={[
          {
            svgAsset: asset(
              1,
              "mo.svg",
              `<svg viewBox="0 0 10 10"><path d="M0 0H10V10H0Z" id="MO-01" data-margin="12.5"/></svg>`,
            ),
            dataAttribute: "data-margin",
          },
        ]}
      />,
    )
    expect(container.querySelector("[data-interactive-map-block]")).not.toHaveAttribute(
      "data-map-mode",
    )
    expect(container.querySelector("[data-interactive-map-path]")).toBeInTheDocument()
  })
})
