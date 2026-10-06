import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DrilldownSelectionProvider } from "@/interactives/engine/selection"

import { AppointmentsChart, ChangeChart, partyColor, partyLabel } from "../Charts"
import type { FederalCourtsSummary } from "../summary"
import { FederalCourtsSummaryView } from "../SummaryView"

const summary: FederalCourtsSummary = {
  supremeCourtRegion: "scotus",
  supremeCourt: [
    {
      _region: "scotus",
      _id: "a",
      full_name: "Sonia Sotomayor",
      display_name: "Sotomayor",
      president_party: "Democratic",
    },
    {
      _region: "scotus",
      _id: "b",
      full_name: "Samuel A. Alito Jr.",
      display_name: "Alito",
      president_party: "Republican",
    },
  ],
  change: {
    startYear: 2024,
    coverageFrom: 1994,
    series: [
      { party: "Republican", counts: [2, 2, 3] },
      { party: "Democratic", counts: [1, 2, 2] },
    ],
  },
  appointments: {
    baseYear: 1994,
    presidents: [
      { name: "A President", party: "Republican" },
      { name: "B President", party: "Democratic" },
    ],
    bursts: [
      { month: 0, president: 0, count: 2 },
      { month: 13, president: 1, count: 1 },
    ],
  },
}

function renderView(select = vi.fn()) {
  const utils = render(
    <DrilldownSelectionProvider value={{ selected: null, select }}>
      <FederalCourtsSummaryView data={summary} />
    </DrilldownSelectionProvider>,
  )
  return { ...utils, select }
}

describe("FederalCourtsSummaryView", () => {
  afterEach(cleanup)

  it("opens on the Supreme Court with its bench and a party tally", () => {
    const { container } = renderView()
    expect(container.querySelector("[data-summary-scotus]")).toBeInTheDocument()
    expect(screen.getByText("Sotomayor")).toBeInTheDocument()
    expect(screen.getByText("Alito")).toBeInTheDocument()
    const tally = container.querySelector("[data-summary-tally]")!
    expect(tally).toHaveTextContent("2 seats")
    expect(tally).toHaveTextContent("R-appointed")
  })

  it("takes the reader from a justice to the Supreme Court", () => {
    const { container, select } = renderView()
    fireEvent.click(container.querySelector("[data-summary-justice='a']")!)
    expect(select).toHaveBeenCalledWith("scotus")
  })

  it("renders standalone, with no drilldown to select into", () => {
    render(<FederalCourtsSummaryView data={summary} />)
    expect(screen.getByText("Sotomayor")).toBeInTheDocument()
  })

  it("says so when a feed carries no bench", () => {
    render(<FederalCourtsSummaryView data={{ ...summary, supremeCourt: [] }} />)
    expect(screen.getByText("No Supreme Court data.")).toBeInTheDocument()
  })
})

/** The landing pane does not offer these while the map is the priority; they still work. */
describe("the parked charts", () => {
  it("charts the bench's composition on a zero baseline, with both endpoints labelled", () => {
    const { container } = render(<ChangeChart change={summary.change!} />)
    const chart = container.querySelector("[data-chart-change]")!
    // One stacked band per party, each named in the legend rather than by colour alone.
    expect(chart.querySelectorAll("path[data-chart-band]")).toHaveLength(2)
    expect(container.querySelector("[data-chart-legend]")).toHaveTextContent("R-appointed")
    expect(chart).toHaveTextContent("3 R-appointed")
    expect(chart).toHaveTextContent("2 D-appointed")
    // The caption says why the series cannot start where coverage does.
    expect(container).toHaveTextContent("starts in 2024")
    expect(container).toHaveTextContent("begins in 1994")
  })

  it("reads out the year under the cursor", () => {
    const { container } = render(<ChangeChart change={summary.change!} />)
    const readout = container.querySelector("[data-chart-change-readout]")!
    expect(readout).toHaveTextContent("Hover the chart")
    const chart = container.querySelector("[data-chart-change]")!
    chart.getBoundingClientRect = () => ({ left: 0, width: 720, top: 0, height: 300 }) as DOMRect
    fireEvent.pointerMove(chart, { clientX: 720 })
    expect(readout).toHaveTextContent("2026: 3 R-appointed · 2 D-appointed")
  })

  it("draws one dot per appointment and bands the axis by president", () => {
    const { container } = render(<AppointmentsChart appointments={summary.appointments!} />)
    const chart = container.querySelector("[data-chart-appointments]")!
    expect(chart.querySelectorAll("circle")).toHaveLength(3)
    expect(chart).toHaveTextContent("President")
  })

  it("reads out the month under the pointer, snapped to the nearest one with dots", () => {
    const { container } = render(<AppointmentsChart appointments={summary.appointments!} />)
    const chart = container.querySelector("[data-chart-appointments]")!
    const readout = container.querySelector("[data-chart-appointments-readout]")!
    chart.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 300 }) as DOMRect
    expect(readout).toHaveTextContent("Hover the chart for a month.")
    fireEvent.pointerMove(chart, { clientX: 0 })
    expect(readout).toHaveTextContent(/: 2 appointments by A President$/)
    fireEvent.pointerMove(chart, { clientX: 1000 })
    expect(readout).toHaveTextContent(/: 1 appointment by B President$/)
    fireEvent.pointerLeave(chart)
    expect(readout).toHaveTextContent("Hover the chart for a month.")
  })

  it("lists the parties in the profile's order, with a president of no party last", () => {
    const { container } = render(
      <AppointmentsChart
        appointments={{
          ...summary.appointments!,
          presidents: [
            { name: "Whig President", party: null },
            { name: "B President", party: "Democratic" },
            { name: "A President", party: "Republican" },
          ],
        }}
      />,
    )
    const legend = container.querySelector("[data-chart-appointments]")!.previousElementSibling!
    const text = legend.textContent ?? ""
    expect(text.indexOf("Other")).toBeGreaterThan(text.indexOf("D-appointed"))
    expect(text.indexOf("Other")).toBeGreaterThan(text.indexOf("R-appointed"))
  })
})

describe("partyColor and partyLabel", () => {
  it("name no party as Other, in the muted colour", () => {
    expect(partyLabel(null)).toBe("Other")
    expect(partyColor(null)).toBe("var(--muted-foreground)")
  })

  it("fall back to the party's own name for one the profile does not know", () => {
    expect(partyLabel("Whig")).toBe("Whig")
    expect(partyColor("Whig")).toMatch(/^(var\(|#|oklch|rgb|hsl)/)
  })

  it("use the profile's short label for a known party", () => {
    expect(partyLabel("Republican")).toBe("R-appointed")
  })
})
