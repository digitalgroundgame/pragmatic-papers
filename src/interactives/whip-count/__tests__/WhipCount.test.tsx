import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import { WhipCount } from "../WhipCount"

const result = (): HTMLElement => document.querySelector<HTMLElement>("[data-whip-count-result]")!

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

  it("starts the reader's count from public backers", () => {
    render(<WhipCount data={whipCountData} storageKey="test" />)
    expect(result()).toHaveTextContent("3 Hale")
    expect(result()).toHaveTextContent("2 Ortiz")
    expect(result()).toHaveTextContent("4 unassigned")
    expect(result()).toHaveTextContent("Nobody has a majority in your count yet.")
    expect(screen.getByLabelText("Your pick for Marion Hale")).toHaveValue("hale")
    expect(screen.getByLabelText("Your pick for Sam Okafor")).toHaveValue("")
  })

  it("counts a pick, names a winner, and remembers the draft", () => {
    const { unmount } = render(<WhipCount data={whipCountData} storageKey="test" />)
    fireEvent.change(screen.getByLabelText("Your pick for Sam Okafor"), {
      target: { value: "hale" },
    })
    fireEvent.change(screen.getByLabelText("Your pick for Grace Lindqvist"), {
      target: { value: "hale" },
    })
    expect(result()).toHaveTextContent("5 Hale")
    expect(result()).toHaveTextContent("Marion Hale wins in your count.")

    unmount()
    render(<WhipCount data={whipCountData} storageKey="test" />)
    expect(screen.getByLabelText("Your pick for Sam Okafor")).toHaveValue("hale")
  })

  it("assigns a bloc at once, except its public backers", () => {
    render(<WhipCount data={whipCountData} storageKey="test" />)
    fireEvent.click(screen.getByRole("button", { name: "Give the Progressive bloc to Hale" }))
    expect(screen.getByLabelText("Your pick for Ana Whitfield")).toHaveValue("hale")
    expect(screen.getByLabelText("Your pick for Luis Navarro")).toHaveValue("hale")
    expect(screen.getByLabelText("Your pick for Daniel Ortiz")).toHaveValue("ortiz")
    expect(result()).toHaveTextContent("Marion Hale wins in your count.")

    fireEvent.click(screen.getByRole("button", { name: "Clear the Progressive bloc" }))
    expect(screen.getByLabelText("Your pick for Ana Whitfield")).toHaveValue("")
  })

  it("lets a reader take a public backer away, and start over", () => {
    render(<WhipCount data={whipCountData} storageKey="test" />)
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
