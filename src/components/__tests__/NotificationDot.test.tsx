import { act, cleanup, render, renderHook } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { resetNotificationStore, useNotification } from "@/providers/NotificationProvider"

import { NotificationDot } from "../NotificationDot"

beforeEach(() => {
  localStorage.clear()
  resetNotificationStore()
})

afterEach(cleanup)

describe("NotificationDot", () => {
  it("renders a decorative dot in the top-right corner until its notification is seen", () => {
    const { container } = render(<NotificationDot name="new-feature" />)

    const dot = container.firstElementChild
    expect(dot).toHaveAttribute("aria-hidden", "true")
    // tests/e2e/screenshot.css hides the dot from visual baselines by this attribute.
    expect(dot).toHaveAttribute("data-slot", "notification-dot")
    expect(dot).toHaveClass("absolute", "top-0.5", "right-0.5", "rounded-full")
  })

  it("renders nothing once its notification has been seen", () => {
    localStorage.setItem("pp:seen:new-feature", "1")

    const { container } = render(<NotificationDot name="new-feature" />)

    expect(container).toBeEmptyDOMElement()
  })

  it("disappears when its notification is marked seen elsewhere", () => {
    const { container } = render(<NotificationDot name="new-feature" />)
    const { result } = renderHook(() => useNotification("new-feature"))

    act(() => result.current.markSeen())

    expect(container).toBeEmptyDOMElement()
  })

  it("ignores other notifications being seen", () => {
    const { container } = render(<NotificationDot name="new-feature" />)
    const { result } = renderHook(() => useNotification("theme-selector"))

    act(() => result.current.markSeen())

    expect(container.firstElementChild).toHaveAttribute("data-slot", "notification-dot")
  })

  it("lets the caller reposition it", () => {
    const { container } = render(<NotificationDot name="new-feature" className="top-0 right-0" />)

    expect(container.firstElementChild).toHaveClass("top-0", "right-0")
    expect(container.firstElementChild).not.toHaveClass("top-0.5")
  })
})
