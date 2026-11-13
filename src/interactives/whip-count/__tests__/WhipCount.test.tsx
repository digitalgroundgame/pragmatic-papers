import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import { WhipCount } from "../WhipCount"

const result = (): HTMLElement => document.querySelector<HTMLElement>("[data-whip-count-result]")!

/** Renders the count with the reader's own count opened. */
function renderDrafting(): ReturnType<typeof render> {
  const view = render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
  fireEvent.click(screen.getByRole("button", { name: "Make your own count" }))
  return view
}

describe("WhipCount", () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it("shows the public count and how far the first candidate is from a majority", () => {
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    expect(
      screen.getByText(/9 vote, so 5 wins\. 3 have publicly backed Marion Hale, 2 short/),
    ).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Backs Hale: 3, Leaning Hale: 1/ })).toBeInTheDocument()
  })

  it("keeps the reader's count out of the way until they ask for it", () => {
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    expect(result()).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Your pick for Sam Okafor")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Make your own count" }))
    expect(result()).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Hide" }))
    expect(result()).not.toBeInTheDocument()
  })

  it("starts the reader's count from public backers", () => {
    renderDrafting()
    expect(result()).toHaveTextContent("3 Hale")
    expect(result()).toHaveTextContent("2 Ortiz")
    expect(result()).toHaveTextContent("4 unassigned")
    expect(result()).toHaveTextContent("Nobody has a majority in your count yet.")
    expect(screen.getByLabelText("Your pick for Marion Hale")).toHaveValue("hale")
    expect(screen.getByLabelText("Your pick for Sam Okafor")).toHaveValue("")
  })

  it("counts a pick, names a winner, and remembers the draft", () => {
    const { unmount } = renderDrafting()
    fireEvent.change(screen.getByLabelText("Your pick for Sam Okafor"), {
      target: { value: "hale" },
    })
    fireEvent.change(screen.getByLabelText("Your pick for Grace Lindqvist"), {
      target: { value: "hale" },
    })
    expect(result()).toHaveTextContent("5 Hale")
    expect(result()).toHaveTextContent("Marion Hale wins in your count.")

    // A saved count opens by itself on the next visit.
    unmount()
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    expect(screen.getByLabelText("Your pick for Sam Okafor")).toHaveValue("hale")
  })

  it("assigns a group at once, except its public backers", () => {
    renderDrafting()
    fireEvent.click(screen.getByRole("button", { name: "Give Progressive to Hale" }))
    expect(screen.getByLabelText("Your pick for Ana Whitfield")).toHaveValue("hale")
    expect(screen.getByLabelText("Your pick for Luis Navarro")).toHaveValue("hale")
    expect(screen.getByLabelText("Your pick for Daniel Ortiz")).toHaveValue("ortiz")
    expect(result()).toHaveTextContent("Marion Hale wins in your count.")

    fireEvent.click(screen.getByRole("button", { name: "Clear Progressive" }))
    expect(screen.getByLabelText("Your pick for Ana Whitfield")).toHaveValue("")
  })

  it("lets a reader take a public backer away, and start over", () => {
    renderDrafting()
    fireEvent.change(screen.getByLabelText("Your pick for Tom Becker"), { target: { value: "" } })
    expect(result()).toHaveTextContent("2 Hale")
    fireEvent.click(screen.getByRole("button", { name: "Start over" }))
    expect(result()).toHaveTextContent("3 Hale")
    expect(window.localStorage.getItem("whip-count-draft:test")).toBeNull()
  })

  it("leaves outgoing members out at first, even when the data counts them", () => {
    const counted = {
      ...whipCountData,
      members: whipCountData.members.map((m) =>
        m.seat === "outgoing" ? { ...m, voting: true } : m,
      ),
    }
    render(<WhipCount title="Who leads?" data={counted} storageKey="test" />)
    expect(screen.getByLabelText("Count outgoing senators as voters")).not.toBeChecked()
    expect(within(screen.getByRole("table")).queryByText("Walter Finch")).not.toBeInTheDocument()
  })

  it("counts outgoing members only when the reader asks", () => {
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    const table = screen.getByRole("table")
    expect(within(table).queryByText("Walter Finch")).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Count outgoing senators as voters"))
    expect(within(table).getByText("Walter Finch")).toBeInTheDocument()
    expect(screen.getByText(/10 vote, so 6 wins/)).toBeInTheDocument()
  })

  it("opens a card with who a vote is, where they stand and the source", () => {
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    const card = (): HTMLElement | null => document.querySelector("[data-vote-card]")
    expect(card()).not.toBeInTheDocument()

    const vote = document.querySelector<HTMLElement>('[data-vote="Luis Navarro"]')!
    fireEvent.pointerEnter(vote, { pointerType: "mouse" })
    expect(card()).toHaveTextContent("Luis Navarro (D-MN)")
    expect(card()).toHaveTextContent("Won’t back Hale")
    expect(card()).toHaveTextContent("Incoming · Progressive")
    expect(within(card()!).getByText("example.com")).toHaveAttribute(
      "href",
      "https://example.com/navarro",
    )

    // A tap pins it, so it stays when the pointer leaves, and a second tap closes it.
    fireEvent.click(vote)
    fireEvent.pointerLeave(vote.parentElement!.parentElement!.parentElement!)
    expect(card()).toBeInTheDocument()
    fireEvent.click(vote)
    expect(card()).not.toBeInTheDocument()
  })

  it("draws the undeclared as empty places that open nothing, and lists them by name, folded away", () => {
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    expect(document.querySelector('[data-vote="Sam Okafor"]')).not.toBeInTheDocument()
    const list = document.querySelector<HTMLElement>("[data-whip-count-undeclared]")!
    const toggle = within(list).getByRole("button", { name: /Undeclared \(1\)/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(within(list).queryByText("Sam Okafor")).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(within(list).getByText("Sam Okafor")).toBeInTheDocument()
    expect(within(list).getAllByRole("listitem")).toHaveLength(1)
  })

  it("says whose pick a vote is in the reader's count, and leaves the unassigned empty", () => {
    renderDrafting()
    expect(document.querySelector('[data-vote="Sam Okafor"]')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Your pick for Sam Okafor"), {
      target: { value: "ortiz" },
    })
    const vote = document.querySelector<HTMLElement>('[data-vote="Sam Okafor"]')!
    fireEvent.pointerEnter(vote, { pointerType: "mouse" })
    expect(document.querySelector("[data-vote-card]")).toHaveTextContent("Your pick: Ortiz")
  })

  it("keeps the reader's count for the visit when the browser refuses storage", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="blocked" />)
    fireEvent.click(screen.getByRole("button", { name: "Make your own count" }))
    fireEvent.change(screen.getByLabelText("Your pick for Sam Okafor"), {
      target: { value: "ortiz" },
    })
    expect(result()).toHaveTextContent("3 Ortiz")
    set.mockRestore()
    get.mockRestore()
  })

  it("starts over from a saved count it can't read", () => {
    window.localStorage.setItem("whip-count-draft:test", "{not json")
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    expect(result()).toHaveTextContent("3 Hale")
    cleanup()
    window.localStorage.setItem("whip-count-draft:test", JSON.stringify({ picks: 4, cleared: 4 }))
    render(<WhipCount title="Who leads?" data={whipCountData} storageKey="test" />)
    expect(result()).toHaveTextContent("4 unassigned")
  })

  it("shows the clock when the count has a vote time, and the download button", () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().replace(".000", "")
    render(
      <WhipCount
        title="Who leads?"
        data={{ ...whipCountData, voteAt: future }}
        storageKey="test"
      />,
    )
    expect(screen.getByRole("timer")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeInTheDocument()
  })
})
