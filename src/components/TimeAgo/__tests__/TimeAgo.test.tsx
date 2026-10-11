import { cleanup, render, screen } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { TimeAgo } from "../index"

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
