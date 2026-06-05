import { cleanup, fireEvent, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { InteractiveMapClient } from "@/blocks/InteractiveMap/Component.client"
import type { ResolvedMap } from "@/blocks/InteractiveMap/types"

const baseMap = (overrides: Partial<ResolvedMap> = {}): ResolvedMap => ({
  title: "Map",
  viewBox: "0 0 30 10",
  transform: null,
  paths: [
    { d: "M0 0H10V10H0Z", regionId: "A", extraAttrs: {} },
    { d: "M10 0H20V10H10Z", regionId: "B", extraAttrs: {} },
    { d: "M20 0H30V10H20Z", regionId: null, extraAttrs: {} },
  ],
  regions: [
    { regionId: "A", label: "Alpha", formattedValue: "R+5.0", color: "#fd5864" },
    { regionId: "B", label: "Beta", formattedValue: "D+3.0", color: "#89aefd" },
  ],
  ...overrides,
})

function interactivePaths(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-interactive-map-path]"))
}

function overlayPath(container: HTMLElement): SVGPathElement {
  // Overlay is the only path with the pointer-events-none class.
  const el = container.querySelector<SVGPathElement>("path.pointer-events-none")
  if (!el) throw new Error("overlay path not found")
  return el
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
      (p) => !p.classList.contains("pointer-events-none"),
    )
    const inert = allPaths[2]!
    expect(inert.getAttribute("tabindex")).toBeNull()
    expect(inert.hasAttribute("data-interactive-map-path")).toBe(false)
  })

  it("shows the overlay path for the hovered region and clears it on leave", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const overlay = overlayPath(container)
    expect(overlay.getAttribute("d")).toBe("")
    expect(overlay.style.visibility).toBe("hidden")

    const [pathA] = interactivePaths(container)
    fireEvent.pointerEnter(pathA!)
    expect(overlay.getAttribute("d")).toBe("M0 0H10V10H0Z")
    expect(overlay.style.visibility).toBe("visible")

    fireEvent.pointerLeave(pathA!)
    expect(overlay.style.visibility).toBe("hidden")
  })

  it("pins the active region on click so pointer leave does not clear it", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const overlay = overlayPath(container)
    const [pathA] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    fireEvent.pointerLeave(pathA!)
    expect(overlay.style.visibility).toBe("visible")
    expect(overlay.getAttribute("d")).toBe("M0 0H10V10H0Z")
  })

  it("Escape clears a pinned selection", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const overlay = overlayPath(container)
    const [pathA] = interactivePaths(container)

    fireEvent.pointerEnter(pathA!)
    fireEvent.click(pathA!)
    expect(overlay.style.visibility).toBe("visible")

    fireEvent.keyDown(document, { key: "Escape" })
    expect(overlay.style.visibility).toBe("hidden")
  })

  it("Enter and Space on a focused path pin the region", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const overlay = overlayPath(container)
    const [pathA, pathB] = interactivePaths(container)

    fireEvent.keyDown(pathA!, { key: "Enter" })
    expect(overlay.getAttribute("d")).toBe("M0 0H10V10H0Z")
    fireEvent.pointerLeave(pathA!)
    expect(overlay.style.visibility).toBe("visible")

    fireEvent.keyDown(pathB!, { key: " " })
    expect(overlay.getAttribute("d")).toBe("M10 0H20V10H10Z")
  })

  it("renders the tooltip with the hovered region label and formatted value", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    // Tooltip is portaled to document.body, not inside the render container.
    const tooltip = document.body.querySelector<HTMLDivElement>('[role="tooltip"]')!
    expect(within(tooltip).queryByText("Alpha")).toBeNull()

    const [pathA] = interactivePaths(container)
    fireEvent.pointerEnter(pathA!)
    expect(within(tooltip).getByText("Alpha")).not.toBeNull()
    expect(within(tooltip).getByText("R+5.0")).not.toBeNull()
  })

  it("uses the grid wrapper class when layout is 'grid' and the flex row class otherwise", () => {
    const { container: gridContainer } = render(
      <InteractiveMapClient layout="grid" maps={[baseMap()]} />,
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

  it("hovering a region in one map does not draw an overlay in the other", () => {
    const { container } = render(
      <InteractiveMapClient
        layout="row"
        maps={[
          baseMap({ title: "First" }),
          baseMap({
            title: "Second",
            paths: [{ d: "M0 0H5V5H0Z", regionId: "A", extraAttrs: {} }],
            regions: [
              { regionId: "A", label: "Alpha-2", formattedValue: "R+1.0", color: "#cd897f" },
            ],
          }),
        ]}
      />,
    )

    const overlays = Array.from(
      container.querySelectorAll<SVGPathElement>("path.pointer-events-none"),
    )
    expect(overlays).toHaveLength(2)

    const firstMapPathA = interactivePaths(container)[0]!
    fireEvent.pointerEnter(firstMapPathA)
    expect(overlays[0]!.style.visibility).toBe("visible")
    expect(overlays[1]!.style.visibility).toBe("hidden")
  })

  it("renders <title> children on interactive paths so screen readers announce label and value", () => {
    const { container } = render(<InteractiveMapClient layout="row" maps={[baseMap()]} />)
    const [pathA] = interactivePaths(container)
    const title = pathA!.querySelector("title")
    expect(title?.textContent).toBe("Alpha: R+5.0")
  })
})
