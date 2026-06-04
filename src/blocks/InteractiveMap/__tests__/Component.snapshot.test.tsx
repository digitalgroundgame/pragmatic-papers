import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { InteractiveMapBlock } from "@/blocks/InteractiveMap/Component"

const minimalSvg = `<svg viewBox="0 0 10 10"><path d="M0 0H10V10H0Z" data-region="MO-01"/></svg>`

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
            svg: minimalSvg,
            regionAttribute: "data-region",
            regions: [{ regionId: "MO-01", label: "District 1", value: 12.5 }],
          },
        ]}
        sources={[{ name: "U.S. Census", url: "https://example.com" }]}
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
})
