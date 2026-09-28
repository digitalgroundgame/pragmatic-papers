import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { landscapeImage, makeSummary, topicFixture, userFixture } from "./fixtures"

vi.mock("@/components/Media", async () => (await import("./mediaStub")).mediaStub)

const { HeroPage } = await import("../HeroPage")

describe("HeroPage", () => {
  it("shows the volume, title, excerpt, byline, date and topics", () => {
    render(
      <HeroPage
        topInset={64}
        article={makeSummary({
          title: "Turnout in the midterms",
          heroImage: landscapeImage,
          volume: { id: 1, title: "Volume XII", slug: "volume-xii" },
          authors: [userFixture(), 99, userFixture({ id: 2, name: "Sam Okafor", slug: "sam" })],
          topics: [topicFixture(), topicFixture({ id: 2, name: "Courts" })],
        })}
      />,
    )

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turnout in the midterms")
    expect(screen.getByText("Volume XII")).toBeInTheDocument()
    expect(screen.getByText("A short description.")).toBeInTheDocument()
    // Unresolved author ids are skipped rather than printed.
    expect(screen.getByText("by Jordan Rivera, Sam Okafor")).toBeInTheDocument()
    expect(screen.getByText("Elections, Courts")).toBeInTheDocument()
    expect(screen.getByRole("time")).toHaveAttribute("dateTime", "2026-09-01T00:00:00.000Z")
    expect(screen.getByAltText("Mountains at sunset")).toBeInTheDocument()
  })

  it("leaves out what the article doesn't have", () => {
    render(
      <HeroPage
        topInset={64}
        article={makeSummary({ meta: {}, publishedAt: null, authors: null, topics: null })}
      />,
    )

    expect(screen.queryByText(/^by /)).not.toBeInTheDocument()
    expect(screen.queryByRole("time")).not.toBeInTheDocument()
    expect(screen.queryByTestId("media")).not.toBeInTheDocument()
  })
})
