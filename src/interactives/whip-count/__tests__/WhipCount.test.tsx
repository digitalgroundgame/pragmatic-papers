import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import { WhipCount } from "../WhipCount"

const result = (): HTMLElement => document.querySelector<HTMLElement>("[data-whip-count-result]")!

/** Renders the count with the reader's own count opened. */
function renderDrafting(): ReturnType<typeof render> {
  const view = render(<WhipCount data={whipCountData} storageKey="test" />)
  fireEvent.click(screen.getByRole("button", { name: "Make your own count" }))
  return view
}

describe("WhipCount", () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it("shows the public count and how far the first candidate is from a majority", () => {
    render(<WhipCount data={whipCountData} storageKey="test" />)
    expect(
      screen.getByText(/9 vote, so 5 wins\. 3 have publicly backed Marion Hale, 2 short/),
    ).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Backs Hale: 3, Leaning Hale: 1/ })).toBeInTheDocument()
  })

  it("keeps the reader's count out of the way until they ask for it", () => {
    render(<WhipCount data={whipCountData} storageKey="test" />)
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
    render(<WhipCount data={whipCountData} storageKey="test" />)
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

  it("counts outgoing members only when the reader asks", () => {
    render(<WhipCount data={whipCountData} storageKey="test" />)
    const table = screen.getByRole("table")
    expect(within(table).queryByText("Walter Finch")).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Count outgoing senators as voters"))
    expect(within(table).getByText("Walter Finch")).toBeInTheDocument()
    expect(screen.getByText(/10 vote, so 6 wins/)).toBeInTheDocument()
  })
})
