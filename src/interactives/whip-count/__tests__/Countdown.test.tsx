import { act, cleanup, render, screen } from "@testing-library/react"
import React from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Countdown, NextUpdate } from "../Countdown"

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

  it("holds its place on the server with hidden digits, so the page doesn't move", () => {
    const host = document.createElement("div")
    host.innerHTML = renderToString(<Countdown to="2026-12-01T00:00:00-05:00" />)
    const clock = host.querySelector("[data-whip-count-countdown]")
    expect(clock).toHaveAttribute("aria-hidden", "true")
    expect(host.querySelector("[role=timer]")).not.toBeInTheDocument()
    const digits = host.querySelectorAll(".tabular-nums")
    expect(digits).toHaveLength(4)
    for (const digit of digits) {
      expect(digit).toHaveClass("invisible")
      expect(digit).toHaveTextContent("00")
    }
    expect(clock).toHaveTextContent("days")
  })

  it("draws nothing once the vote has passed, or for a time it can't read", () => {
    const { container, rerender } = render(<Countdown to="2026-11-01T00:00:00Z" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<Countdown to="soon" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("NextUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("names the next check in the reader's time", () => {
    render(<NextUpdate updates={{ times: ["07:37", "21:37"], timeZone: "America/New_York" }} />)
    const line = document.querySelector("[data-whip-count-next-update]")!
    expect(line).toHaveTextContent(/Next check for new statements: (today|tomorrow) at \d/)
    expect(line.querySelector("time")).toHaveAttribute("datetime", "2026-11-13T12:37:00.000Z")
  })

  it("holds its line on the server with hidden text", () => {
    const host = document.createElement("div")
    host.innerHTML = renderToString(
      <NextUpdate updates={{ times: ["07:37"], timeZone: "America/New_York" }} />,
    )
    const line = host.querySelector("[data-whip-count-next-update]")
    expect(line).toHaveAttribute("aria-hidden", "true")
    expect(line?.firstElementChild).toHaveClass("invisible")
    expect(line?.querySelector("time")).not.toBeInTheDocument()
  })

  it("says nothing once the vote has passed", () => {
    const updates = { times: ["07:37"], timeZone: "America/New_York" }
    const { container, rerender } = render(
      <NextUpdate updates={updates} voteAt="2026-11-13T00:00:00-05:00" />,
    )
    expect(container).toBeEmptyDOMElement()
    rerender(<NextUpdate updates={updates} voteAt="2026-12-01T00:00:00-05:00" />)
    expect(container).not.toBeEmptyDOMElement()
  })
})
