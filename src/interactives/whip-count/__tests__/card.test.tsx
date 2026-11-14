import { render } from "@testing-library/react"
import React from "react"
import { describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import { WhipCountCard } from "../card"

const now = new Date("2026-11-14T17:00:00Z")

describe("WhipCountCard", () => {
  it("sets the leading candidates against each other with the count and the countdown", () => {
    const { container } = render(
      <WhipCountCard
        title="Who leads?"
        data={{ ...whipCountData, voteAt: "2026-12-01T09:30:00-05:00" }}
        now={now}
      />,
    )
    expect(container).toHaveTextContent("Pragmatic Papers")
    expect(container).toHaveTextContent("WHIP COUNT · AS OF NOVEMBER 13, 2026")
    expect(container).toHaveTextContent(/Marion Hale\s*3\s*backing, plus 1 leaning/)
    expect(container).toHaveTextContent(/vs\s*Daniel Ortiz\s*2\s*publicly backing/)
    expect(container).toHaveTextContent("5 of 9 votes to win")
    expect(container).toHaveTextContent("17 days to the vote")
  })

  it("leaves the countdown out with no vote time", () => {
    const { container } = render(
      <WhipCountCard title="Who leads?" data={whipCountData} now={now} />,
    )
    expect(container).not.toHaveTextContent("to the vote")
  })
})
