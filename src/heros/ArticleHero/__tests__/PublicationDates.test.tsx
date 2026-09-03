import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { PublicationDates } from "../PublicationDates"

afterEach(cleanup)

// Noon UTC is 8:00 a.m. in the publication's timezone, so the day is the same
// either way and these read the way a reader would see them.
const PUBLISHED = "2024-06-15T12:00:00.000Z"

describe("PublicationDates", () => {
  it("renders nothing for an unpublished article", () => {
    const { container } = render(
      <PublicationDates publishedAt={null} updatedAt="2024-06-15T12:00:00.000Z" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("stamps the publication date", () => {
    render(<PublicationDates publishedAt={PUBLISHED} updatedAt={PUBLISHED} />)
    expect(screen.getByText("June 15, 2024")).toHaveAttribute("datetime", PUBLISHED)
  })

  it("ignores the save that publishing itself stamps", () => {
    render(<PublicationDates publishedAt={PUBLISHED} updatedAt="2024-06-15T12:00:30.000Z" />)
    expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument()
  })

  it("gives the time of a revision made the same day", () => {
    render(<PublicationDates publishedAt={PUBLISHED} updatedAt="2024-06-15T18:56:00.000Z" />)
    const updated = screen.getByText(/^Updated /)
    expect(updated).toHaveTextContent("Updated 2:56 p.m. ET")
    expect(updated).toHaveAttribute("datetime", "2024-06-15T18:56:00.000Z")
  })

  it("gives the date of a revision made later on", () => {
    render(<PublicationDates publishedAt={PUBLISHED} updatedAt="2024-06-20T09:30:00.000Z" />)
    expect(screen.getByText(/^Updated /)).toHaveTextContent("Updated June 20, 2024")
  })

  it("keeps the dateline reachable by keyboard now that it is not a link", () => {
    render(<PublicationDates publishedAt={PUBLISHED} updatedAt={PUBLISHED} />)
    // The trigger is a <span> so the <time> semantics survive, which costs the
    // focusability a link would have given it.
    expect(
      screen.getByText("June 15, 2024").closest("[data-slot='tooltip-trigger']"),
    ).toHaveAttribute("tabindex", "0")
  })
})
