import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { InteractiveMapBlock } from "@/blocks/InteractiveMap/InteractiveMapBlock"
import type { MapAsset } from "@/payload-types"

const minimalSvg = `<svg viewBox="0 0 10 10"><path d="M0 0H10V10H0Z" id="MO-01" data-margin="12.5"/></svg>`

const stubAsset = (svgContent: string): MapAsset => ({
  id: 1,
  svgContent,
  updatedAt: "2025-01-01T00:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
  url: "/map-assets/test.svg",
  filename: "test.svg",
  mimeType: "image/svg+xml",
})

// Snapshot tests for the InteractiveMap server component. To update snapshots after intentional changes:
// pnpm test:unit -- --update-snapshots
describe("InteractiveMapBlock", () => {
  it("renders a single map with diverging color scale", () => {
    const { container } = render(
      <InteractiveMapBlock
        blockType="interactiveMap"
        widgetTitle="Missouri"
        layout="row"
        colorScale="divergingRedBlue"
        maps={[
          {
            title: "119th Congress",
            svgAsset: stubAsset(minimalSvg),
            dataAttribute: "data-margin",
            overrides: [{ regionId: "MO-01", label: "District 1" }],
          },
        ]}
        sources={[
          {
            link: {
              type: "custom",
              url: "https://example.com",
              label: "U.S. Census",
              newTab: true,
              variant: "link",
            },
          },
        ]}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders nothing when there are no maps", () => {
    const { container } = render(
      <InteractiveMapBlock
        blockType="interactiveMap"
        layout="row"
        colorScale="divergingRedBlue"
        maps={[]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("skips maps whose svgAsset has not been populated (id-only ref)", () => {
    const { container } = render(
      <InteractiveMapBlock
        blockType="interactiveMap"
        layout="row"
        colorScale="divergingRedBlue"
        maps={[
          {
            title: "Unpopulated",
            svgAsset: 42,
            overrides: [],
          },
        ]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
