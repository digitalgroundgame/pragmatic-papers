import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const rowLabel = vi.hoisted(() => ({
  value: {} as { data?: { source?: string; title?: string | null }; rowNumber?: number },
}))

// The real hook needs the admin form context; the pill is a styled span.
vi.mock("@payloadcms/ui", () => ({
  useRowLabel: () => rowLabel.value,
  Pill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

import { PanelBlockLabel } from "../BlockLabel"

afterEach(cleanup)

describe("PanelBlockLabel", () => {
  it("names a collapsed panel by what it lists", () => {
    rowLabel.value = { data: { source: "latestVolume" }, rowNumber: 0 }
    render(<PanelBlockLabel path="aside.0" />)
    expect(screen.getByText("01")).toBeInTheDocument()
    expect(screen.getByText("Panel")).toBeInTheDocument()
    expect(screen.getByText("Latest volume")).toBeInTheDocument()
  })

  it("puts the heading an editor gave it first", () => {
    rowLabel.value = { data: { source: "topics", title: "Sections" }, rowNumber: 2 }
    render(<PanelBlockLabel path="aside.2" />)
    expect(screen.getByText("Sections (Browse topics)")).toBeInTheDocument()
  })
})
