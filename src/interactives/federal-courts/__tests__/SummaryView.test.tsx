import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DrilldownSelectionProvider } from "@/blocks/InteractiveMap/drilldown/selection"

import type { FederalCourtsSummary } from "../summary"
import { FederalCourtsSummaryView } from "../Summary"

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
  cartogram: [
    {
      id: "ca8",
      offset: [0, 0],
      rows: 1,
      cols: 2,
      cells: [
        [0, 0, "moed", "Republican"],
        [0, 1, "arw", null],
      ],
    },
  ],
  districtTotals: [
    { party: "Republican", count: 1 },
    { party: null, count: 1 },
  ],
  labels: { ca8: "8th Cir.", moed: "E.D. Mo.", arw: "W.D. Ark.", scotus: "SCOTUS" },
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

  it("switches to the district cartogram, one square per judgeship", () => {
    const { container } = renderView()
    fireEvent.click(screen.getByRole("button", { name: "District courts" }))
    const cartogram = container.querySelector("[data-summary-cartogram]")!
    expect(cartogram.querySelectorAll("rect[data-summary-seat]")).toHaveLength(2)
    expect(container.querySelector("[data-summary-tally]")).toHaveTextContent(
      "2 district judgeships",
    )
    // The circuit is captioned on the map itself, in the feed's own wording.
    expect(within(cartogram as unknown as HTMLElement).getByText("8th")).toBeInTheDocument()
  })

  it("names the district under the cursor rather than leaving the reader to guess", () => {
    const { container } = renderView()
    fireEvent.click(screen.getByRole("button", { name: "District courts" }))
    const hint = container.querySelector("[data-summary-cartogram-hint]")!
    expect(hint).toHaveTextContent("Hover a seat")
    fireEvent.pointerEnter(container.querySelector("rect[data-summary-seat='moed']")!)
    expect(hint).toHaveTextContent("E.D. Mo. · 8th Cir.")
  })

  it("takes the reader from a seat to that district on the map", () => {
    const { container, select } = renderView()
    fireEvent.click(screen.getByRole("button", { name: "District courts" }))
    fireEvent.click(container.querySelector("rect[data-summary-seat='arw']")!)
    expect(select).toHaveBeenCalledWith("arw")
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

  it("says so when a feed carries neither bench nor layout", () => {
    render(
      <FederalCourtsSummaryView
        data={{ ...summary, supremeCourt: [], cartogram: [], districtTotals: [] }}
      />,
    )
    expect(screen.getByText("No Supreme Court data.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "District courts" }))
    expect(screen.getByText("No district layout.")).toBeInTheDocument()
  })
})
