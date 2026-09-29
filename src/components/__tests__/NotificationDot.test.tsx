import { cleanup, render } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it } from "vitest"

import { NotificationDot } from "../NotificationDot"

afterEach(cleanup)

describe("NotificationDot", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(<NotificationDot visible={false} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("renders a decorative dot in the top-right corner when visible", () => {
    const { container } = render(<NotificationDot visible />)

    const dot = container.firstElementChild
    expect(dot).toHaveAttribute("aria-hidden", "true")
    // tests/e2e/screenshot.css hides the dot from visual baselines by this attribute.
    expect(dot).toHaveAttribute("data-slot", "notification-dot")
    expect(dot).toHaveClass("absolute", "top-0.5", "right-0.5", "rounded-full")
  })

  it("lets the caller reposition it", () => {
    const { container } = render(<NotificationDot visible className="top-0 right-0" />)

    expect(container.firstElementChild).toHaveClass("top-0", "right-0")
    expect(container.firstElementChild).not.toHaveClass("top-0.5")
  })
})
