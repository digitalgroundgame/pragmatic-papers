import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const rowLabel = vi.hoisted(() => ({
  value: {} as { data?: { heading?: string | null }; rowNumber?: number },
}))

// The real hook needs the admin form context; the pill is a styled span.
vi.mock("@payloadcms/ui", () => ({
  useRowLabel: () => rowLabel.value,
  Pill: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}))

import { MerchBlockLabel } from "../BlockLabel"

beforeEach(() => {
  rowLabel.value = { data: { heading: "Support Us" }, rowNumber: 1 }
})

afterEach(cleanup)

describe("MerchBlockLabel", () => {
  it("names the row by its heading", () => {
    render(<MerchBlockLabel path="layout.1" />)

    expect(screen.getByText("Support Us")).toBeInTheDocument()
  })

  it("keeps the row number and block pill the default header would have shown", () => {
    // A custom Label replaces the whole header fragment, so losing these is the
    // easy mistake — the row reads as a different kind of thing without them.
    render(<MerchBlockLabel path="layout.1" />)

    expect(screen.getByText("02")).toBeInTheDocument()
    expect(screen.getByText("Merch")).toBeInTheDocument()
  })

  it("falls back to the block name alone when there's no heading", () => {
    rowLabel.value = { data: { heading: null }, rowNumber: 0 }

    render(<MerchBlockLabel path="layout.1" />)

    expect(screen.getByText("01")).toBeInTheDocument()
    expect(screen.getByText("Merch")).toBeInTheDocument()
  })

  it("ignores a heading that's only whitespace", () => {
    rowLabel.value = { data: { heading: "   " }, rowNumber: 0 }

    const { container } = render(<MerchBlockLabel path="layout.1" />)

    expect(container.textContent).toBe("01Merch")
  })
})
