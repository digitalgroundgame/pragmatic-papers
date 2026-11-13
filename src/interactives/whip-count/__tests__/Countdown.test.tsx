import { act, cleanup, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Countdown } from "../Countdown"

describe("Countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("counts down to the vote and ticks", () => {
    render(<Countdown to="2026-12-01T00:00:00-05:00" />)
    // Dec 1 05:00 UTC is 17 days and 17 hours after Nov 13 12:00 UTC.
    expect(screen.getByRole("timer")).toHaveTextContent("17days17hours00minutes00seconds")
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole("timer")).toHaveTextContent("17days16hours59minutes59seconds")
  })

  it("draws nothing once the vote has passed, or for a time it can't read", () => {
    const { container, rerender } = render(<Countdown to="2026-11-01T00:00:00Z" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<Countdown to="soon" />)
    expect(container).toBeEmptyDOMElement()
  })
})
