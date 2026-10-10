import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { makeSummary, userFixture } from "./fixtures"

vi.mock("@/components/Media", async () => (await import("./mediaStub")).mediaStub)
vi.mock("@/utilities/getURL", () => ({ getClientURL: () => "https://example.com" }))

const { FeedActionColumn } = await import("../FeedActionColumn")

const people = [
  userFixture({ id: 1, name: "Jordan Rivera", slug: "jordan" }),
  userFixture({ id: 2, name: "Sam Okafor", slug: "sam", profileImage: null }),
  userFixture({ id: 3, name: "Priya", slug: "priya" }),
  userFixture({ id: 4, name: "Lee", slug: "lee" }),
]

describe("FeedActionColumn", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("links up to three authors and counts the rest", () => {
    render(<FeedActionColumn article={makeSummary({ authors: [...people, 7] })} />)

    expect(screen.getByRole("link", { name: "Jordan Rivera" })).toHaveAttribute(
      "href",
      "/contributors/jordan",
    )
    expect(screen.getAllByRole("link")).toHaveLength(3)
    expect(screen.getByLabelText("1 more authors")).toHaveTextContent("+1")
    // No profile image: initials stand in.
    expect(screen.getByText("SO")).toBeInTheDocument()
  })

  it("skips authors without a profile to link to", () => {
    render(
      <FeedActionColumn
        article={makeSummary({ authors: [userFixture({ slug: null as unknown as string })] })}
      />,
    )
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("shares through the native sheet when there is one", () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal("navigator", { share })

    render(<FeedActionColumn article={makeSummary({ slug: "turnout", title: "Turnout" })} />)
    fireEvent.click(screen.getByRole("button", { name: "Share article" }))

    expect(share).toHaveBeenCalledWith({
      title: "Turnout",
      url: "https://example.com/articles/turnout",
    })
  })

  it("copies the link when the browser can't share", () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    render(<FeedActionColumn article={makeSummary({ slug: "turnout" })} />)
    fireEvent.click(screen.getByRole("button", { name: "Share article" }))

    expect(writeText).toHaveBeenCalledWith("https://example.com/articles/turnout")
  })
})
