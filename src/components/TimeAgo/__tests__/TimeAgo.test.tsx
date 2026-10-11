import { cleanup, render, screen } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { TimeAgo, formatTimeAgo } from "../index"

// The output is measured against the clock, so it has to stand still.
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date("2024-06-20T12:00:00.000Z"))
})

afterAll(() => {
  vi.useRealTimers()
})

afterEach(cleanup)

describe("TimeAgo", () => {
  it("phrases the distance from now", () => {
    render(<TimeAgo publishedAt="2024-06-15T12:00:00.000Z" />)
    expect(screen.getByText("5 days ago")).toBeInTheDocument()
  })

  it("suffixes a future date the other way round", () => {
    render(<TimeAgo publishedAt="2024-06-22T12:00:00.000Z" />)
    expect(screen.getByText("in 2 days")).toBeInTheDocument()
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("renders nothing when the date is %s", (_label, publishedAt) => {
    const { container } = render(<TimeAgo publishedAt={publishedAt} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("formatTimeAgo", () => {
  it.each([
    ["2024-06-20T11:59:50.000Z", "just now"],
    ["2024-06-20T11:57:00.000Z", "3 minutes ago"],
    ["2024-06-20T11:10:00.000Z", "1 hour ago"],
    ["2024-06-20T09:00:00.000Z", "3 hours ago"],
    ["2024-06-19T10:00:00.000Z", "yesterday"],
    ["2024-06-15T12:00:00.000Z", "5 days ago"],
    ["2024-05-22T12:00:00.000Z", "last month"],
    ["2024-03-20T12:00:00.000Z", "3 months ago"],
    ["2023-08-01T12:00:00.000Z", "last year"],
    ["2021-06-20T12:00:00.000Z", "3 years ago"],
    ["2024-06-22T12:00:00.000Z", "in 2 days"],
  ])("phrases %s as %j", (timestamp, expected) => {
    expect(formatTimeAgo(timestamp)).toBe(expected)
  })
})
