import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FEDERAL_COURTS_PROFILE_ID } from "../federal-courts"
import type { FederalCourtsSummary } from "../federal-courts/summary"
import { renderSummary } from "../summaryViews"

vi.mock("../federal-courts/SummaryView", () => ({
  FederalCourtsSummaryView: ({ data }: { data: FederalCourtsSummary }) => (
    <div data-testid="summary">{data.supremeCourtRegion}</div>
  ),
}))

describe("renderSummary", () => {
  it("renders a profile's view of its composed summary", () => {
    const composed = { supremeCourtRegion: "scotus" } as FederalCourtsSummary
    render(<>{renderSummary(FEDERAL_COURTS_PROFILE_ID, composed)}</>)
    expect(screen.getByTestId("summary")).toHaveTextContent("scotus")
  })

  it("renders nothing for a profile without a view, or without a summary", () => {
    expect(renderSummary("unknown", { supremeCourtRegion: "scotus" })).toBeNull()
    expect(renderSummary(FEDERAL_COURTS_PROFILE_ID, null)).toBeNull()
  })
})

describe("the profiles", () => {
  // The Payload config imports them (the collection's options, the sync job), so any client
  // component they import ships in every page's JavaScript.
  it("don't import the summary view", async () => {
    vi.resetModules()
    vi.doMock("../federal-courts/SummaryView", () => {
      throw new Error("the profiles imported SummaryView")
    })
    await expect(import("../profiles")).resolves.toBeDefined()
    vi.doUnmock("../federal-courts/SummaryView")
  })
})
