import { cleanup, render } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetNotificationStore } from "@/providers/NotificationProvider"

import { TopicVisitTracker } from "../TopicVisitTracker"

beforeEach(() => {
  localStorage.clear()
  resetNotificationStore()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("TopicVisitTracker", () => {
  it("records the visit under the topic's slug and renders nothing", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"))

    const { container } = render(<TopicVisitTracker slug="economy" />)

    expect(container).toBeEmptyDOMElement()
    expect(localStorage.getItem("pp:lastVisited:topic:economy")).toBe("2026-09-01T12:00:00.000Z")
  })

  it("records a new visit when the slug changes", () => {
    const { rerender } = render(<TopicVisitTracker slug="economy" />)
    rerender(<TopicVisitTracker slug="housing" />)

    expect(localStorage.getItem("pp:lastVisited:topic:economy")).not.toBeNull()
    expect(localStorage.getItem("pp:lastVisited:topic:housing")).not.toBeNull()
  })
})
