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

  it("scrolls the line when it doesn't fit, and not when it does", () => {
    const width = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(400)
    const client = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200)
    try {
      const { unmount } = render(<FeedByline article={makeSummary({ title: "A long title" })} />)
      const line = screen.getByText("A long title")
      expect(line).toHaveClass("feed-marquee")
      expect(line.style.getPropertyValue("--feed-marquee-shift")).toBe("200px")
      unmount()

      width.mockReturnValue(204)
      render(<FeedByline article={makeSummary({ title: "Short" })} />)
      expect(screen.getByText("Short")).toHaveClass("truncate")
    } finally {
      width.mockRestore()
      client.mockRestore()
    }
  })

  it("renders nothing with neither a title nor authors", () => {
    const { container } = render(<FeedByline article={makeSummary({ title: "", authors: [] })} />)
    expect(container).toBeEmptyDOMElement()
  })
})
