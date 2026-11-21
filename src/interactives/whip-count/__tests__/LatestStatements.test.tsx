import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it } from "vitest"

import { whipCountData, whipCountWithStatements } from "@/stories/fixtures/whipCount"

import { LatestStatements, STATEMENTS_SHOWN } from "../LatestStatements"

afterEach(cleanup)

describe("LatestStatements", () => {
  it("lists statements newest first, with who said it, when and where", () => {
    render(<LatestStatements data={whipCountWithStatements} />)
    const section = screen.getByRole("region", { name: "Latest statements" })
    const items = within(section).getAllByRole("listitem")
    expect(items).toHaveLength(STATEMENTS_SHOWN)
    expect(items[0]).toHaveTextContent("Daniel Ortiz (D-MD)")
    expect(items[0]).toHaveTextContent("November 13, 2026")
    expect(within(items[0]!).getByRole("link", { name: "example.com" })).toHaveAttribute(
      "href",
      "https://example.com/ortiz",
    )
    // Someone no longer in the count keeps their state, without a party.
    fireEvent.click(screen.getByRole("button", { name: "Show all 9 statements" }))
    expect(within(section).getAllByRole("listitem")).toHaveLength(9)
    expect(within(section).getAllByRole("listitem")[8]).toHaveTextContent("Former Member (OH)")
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }))
    expect(within(section).getAllByRole("listitem")).toHaveLength(STATEMENTS_SHOWN)
  })

  it("has no Show all button when every statement fits", () => {
    render(<LatestStatements data={whipCountData} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders nothing without a dated statement", () => {
    const undated = {
      ...whipCountData,
      members: whipCountData.members.map(({ basisDate: _d, ...m }) => m),
    }
    const { container } = render(<LatestStatements data={undated} />)
    expect(container).toBeEmptyDOMElement()
  })
})
