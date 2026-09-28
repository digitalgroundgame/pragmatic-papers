import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { makeSummary, userFixture } from "./fixtures"

vi.mock("@/components/Media", async () => (await import("./mediaStub")).mediaStub)

const { FeedByline } = await import("../FeedByline")

describe("FeedByline", () => {
  it("joins the title and resolved author names", () => {
    render(
      <FeedByline
        article={makeSummary({
          title: "Turnout",
          authors: [userFixture(), 5, userFixture({ id: 2, name: "Sam Okafor" })],
        })}
      />,
    )
    expect(screen.getByText("Turnout · Jordan Rivera, Sam Okafor")).toBeInTheDocument()
  })

  it("falls back to the title's initial with no hero image", () => {
    render(<FeedByline article={makeSummary({ title: "turnout", authors: [] })} />)
    expect(screen.getByText("turnout")).toBeInTheDocument()
    expect(screen.getByText("T")).toBeInTheDocument()
  })
})
