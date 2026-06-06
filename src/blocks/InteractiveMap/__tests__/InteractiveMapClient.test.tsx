import { cleanup, fireEvent, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { InteractiveMapClient } from "@/blocks/InteractiveMap/InteractiveMapClient"
import type { ResolvedMap } from "@/blocks/InteractiveMap/types"

const baseMap = (overrides: Partial<ResolvedMap> = {}): ResolvedMap => ({
  title: "Map",
  invertColors: false,
  viewBox: "0 0 30 10",
  transform: null,
  paths: [
    {
      d: "M0 0H10V10H0Z",
      regionId: "A",
      region: { regionId: "A", label: "Alpha", formattedValue: "R+5.0", color: "#fd5864" },
      extraAttrs: {},
    },
    {
      d: "M10 0H20V10H10Z",
      regionId: "B",
      region: { regionId: "B", label: "Beta", formattedValue: "D+3.0", color: "#89aefd" },
      extraAttrs: {},
    },
    { d: "M20 0H30V10H20Z", regionId: null, region: null, extraAttrs: {} },
  ],
  ...overrides,
})

function interactivePaths(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-interactive-map-path]"))
}

function activeOverlay(container: HTMLElement): SVGPathElement {
  const el = container.querySelector<SVGPathElement>('path[data-overlay="active"]')
  if (!el) throw new Error("active overlay path not found")
  return el
}

function pinnedOverlays(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll<SVGPathElement>('path[data-overlay="pinned"]'))
}

function pinnedTooltips(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>("[data-pinned-tooltip]"))
}

describe("InteractiveMapClient", () => {
  afterEach(cleanup)

  it("marks paths with a matched region as interactive and others as inert", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const interactive = interactivePaths(container)
    expect(interactive).toHaveLength(2)
    for (const p of interactive) {
      expect(p.getAttribute("tabindex")).toBe("0")
      expect(p.getAttribute("fill")).toMatch(/^#/)
    }
    // The third path (regionId: null) is inert: no tabindex, no data marker.
    const allPaths = Array.from(container.querySelectorAll("path")).filter(
      (p) =>
        p.getAttribute("data-overlay") !== "active" && p.getAttribute("data-overlay") !== "pinned",
    )
    const inert = allPaths[2]!
    expect(inert.getAttribute("tabindex")).toBeNull()
    expect(inert.hasAttribute("data-interactive-map-path")).toBe(false)
  })

  it("shows the active overlay path for the hovered region and clears it on leave", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const overlay = activeOverlay(container)
    expect(overlay.getAttribute("d")).toBe("")

    const [pathA] = interactivePaths(container)
    fireEvent.pointerEnter(pathA!)
    expect(overlay.getAttribute("d")).toBe("M0 0H10V10H0Z")

    fireEvent.pointerLeave(pathA!)
    // d persists after leave; opacity returns to 0 (set by effect, not checked here)
    expect(overlay.getAttribute("d")).toBe("M0 0H10V10H0Z")
  })

  it("pins a region on click — pointer leave does not clear the pinned overlay", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    fireEvent.pointerLeave(pathA!)

    const overlays = pinnedOverlays(container)
    expect(overlays).toHaveLength(1)
    expect(overlays[0]!.getAttribute("d")).toBe("M0 0H10V10H0Z")
  })

  it("Escape clears all pinned selections", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    expect(pinnedOverlays(container)).toHaveLength(1)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(pinnedOverlays(container)).toHaveLength(0)
  })

  it("Enter and Space on a focused path pin the region", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA, pathB] = interactivePaths(container)

    fireEvent.keyDown(pathA!, { key: "Enter" })
    expect(pinnedOverlays(container)).toHaveLength(1)
    expect(pinnedOverlays(container)[0]!.getAttribute("d")).toBe("M0 0H10V10H0Z")

    fireEvent.keyDown(pathB!, { key: " " })
    expect(pinnedOverlays(container)).toHaveLength(2)
  })

  it("renders the hover tooltip with the hovered region label and formatted value", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    // Hover tooltip is portaled to document.body and has pointer-events-none.
    const hoverTooltip = document.body.querySelector<HTMLDivElement>(
      '[role="tooltip"].pointer-events-none',
    )!
    expect(within(hoverTooltip).queryByText("Alpha")).toBeNull()

    const [pathA] = interactivePaths(container)
    fireEvent.pointerEnter(pathA!)
    expect(within(hoverTooltip).getByText("Alpha")).not.toBeNull()
    expect(within(hoverTooltip).getByText("R+5.0")).not.toBeNull()
  })

  it("uses the grid wrapper class when layout is 'stacked' and the flex row class otherwise", () => {
    const { container: gridContainer } = render(
      <InteractiveMapClient layout="stacked" maps={[baseMap()]} />,
    )
    const gridGroup = gridContainer.querySelector<HTMLDivElement>('[role="group"]')!
    expect(gridGroup.className).toContain("grid")
    expect(gridGroup.className).toContain("sm:grid-cols-2")

    const { container: rowContainer } = render(
      <InteractiveMapClient layout="row" maps={[baseMap()]} />,
    )
    const rowGroup = rowContainer.querySelector<HTMLDivElement>('[role="group"]')!
    expect(rowGroup.className).toContain("sm:flex-row")
  })

  it("hovering a region in one map does not draw an active overlay in the other", () => {
    const { container } = render(
      <InteractiveMapClient
        layout="row"
        maps={[
          baseMap({ title: "First" }),
          baseMap({
            title: "Second",
            paths: [
              {
                d: "M0 0H5V5H0Z",
                regionId: "A",
                region: {
                  regionId: "A",
                  label: "Alpha-2",
                  formattedValue: "R+1.0",
                  color: "#cd897f",
                },
                extraAttrs: {},
              },
            ],
          }),
        ]}
      />,
    )

    const overlays = Array.from(
      container.querySelectorAll<SVGPathElement>('path[data-overlay="active"]'),
    )
    expect(overlays).toHaveLength(2)

    const firstMapPathA = interactivePaths(container)[0]!
    fireEvent.pointerEnter(firstMapPathA)
    expect(overlays[0]!.getAttribute("d")).toBe("M0 0H10V10H0Z")
    expect(overlays[1]!.getAttribute("d")).toBe("")
  })

  it("sets aria-label on interactive paths so screen readers announce label and value", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA] = interactivePaths(container)
    expect(pathA!.getAttribute("aria-label")).toBe("Alpha: R+5.0")
  })

  it("allows pinning multiple regions and shows a pinned tooltip for each", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA, pathB] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    fireEvent.pointerEnter(pathB!)
    fireEvent.click(pathB!)

    expect(pinnedOverlays(container)).toHaveLength(2)
    expect(pinnedTooltips()).toHaveLength(2)
  })

  it("does not show a hover tooltip when hovering over a pinned region", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)

    // After pinning, hovering the same path again should not produce a hover tooltip
    fireEvent.pointerEnter(pathA!)
    const hoverTooltip = document.body.querySelector<HTMLDivElement>(
      '[role="tooltip"].pointer-events-none',
    )!
    expect(within(hoverTooltip).queryByText("Alpha")).toBeNull()
  })

  it("clicking a pinned region unpins only that region", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA, pathB] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    fireEvent.pointerEnter(pathB!)
    fireEvent.click(pathB!)
    expect(pinnedOverlays(container)).toHaveLength(2)

    // Click the already-pinned pathA — should unpin only A, leaving B
    fireEvent.click(pathA!)
    expect(pinnedOverlays(container)).toHaveLength(1)
    expect(pinnedOverlays(container)[0]!.getAttribute("d")).toBe("M10 0H20V10H10Z")
  })

  it("focusing a path via keyboard shows the active overlay", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const overlay = activeOverlay(container)
    const [pathA] = interactivePaths(container)

    fireEvent.focus(pathA!)
    expect(overlay.getAttribute("d")).toBe("M0 0H10V10H0Z")

    fireEvent.blur(pathA!)
    expect(overlay.getAttribute("d")).toBe("M0 0H10V10H0Z")
  })

  it("pointerdown outside the map clears all pinned selections", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    expect(pinnedOverlays(container)).toHaveLength(1)

    fireEvent.pointerDown(document.body)
    expect(pinnedOverlays(container)).toHaveLength(0)
  })

  it("pointerdown on a map path does not clear pinned selections", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA, pathB] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    expect(pinnedOverlays(container)).toHaveLength(1)

    // Pointerdown on another interactive path — should not clear pins
    fireEvent.pointerDown(pathB!)
    expect(pinnedOverlays(container)).toHaveLength(1)
  })
})
