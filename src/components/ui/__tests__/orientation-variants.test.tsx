import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"

afterEach(cleanup)

/**
 * Base UI reports orientation as `data-orientation="horizontal" | "vertical"`, so
 * styles have to select on that attribute. Utilities written as `data-horizontal:`
 * (a bare `[data-horizontal]` selector) silently match nothing, which collapsed the
 * slider track to 0×0 and left only the thumb clickable.
 */
function bareOrientationClasses(element: Element): string[] {
  return Array.from(element.classList).filter((c) => /^data-(horizontal|vertical):/.test(c))
}

describe("orientation variants", () => {
  it("slider parts select on the orientation attribute Base UI renders", () => {
    const { container } = render(<Slider value={[10]} min={0} max={100} />)

    const parts = container.querySelectorAll("[data-orientation]")
    expect(parts.length).toBeGreaterThan(0)

    for (const part of parts) {
      // A bare `data-horizontal:`/`data-vertical:` utility selects an attribute
      // Base UI never renders, so it would apply to nothing.
      expect(bareOrientationClasses(part)).toEqual([])
      // Every orientation utility the part carries has to resolve against the
      // attribute it actually has.
      expect(part.matches('[data-orientation="horizontal"]')).toBe(true)
    }
  })

  it("gives the slider track a horizontal sizing rule", () => {
    const { container } = render(<Slider value={[10]} min={0} max={100} />)
    const track = container.querySelector('[data-slot="slider-track"]')!
    expect(track.className).toContain("data-[orientation=horizontal]:h-1")
    expect(track.className).toContain("data-[orientation=horizontal]:w-full")
  })

  it("pads the slider control so presses land outside the 1-unit track", () => {
    const { container } = render(<Slider value={[10]} min={0} max={100} />)
    const control = container.querySelector("[data-base-ui-slider-control]")!
    expect(control.className).toContain("data-[orientation=horizontal]:py-2")
  })

  it("separator selects on the orientation attribute", () => {
    const { container } = render(<Separator />)
    const separator = container.querySelector('[data-slot="separator"]')!
    expect(separator.getAttribute("data-orientation")).toBe("horizontal")
    expect(bareOrientationClasses(separator)).toEqual([])
    expect(separator.className).toContain("data-[orientation=horizontal]:h-px")
  })
})
