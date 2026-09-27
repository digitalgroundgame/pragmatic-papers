import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

import { MenuSheet } from "../Component"

function renderSheet(): void {
  render(
    <MenuSheet>
      <SheetTrigger>Menu</SheetTrigger>
      <SheetContent>
        <SheetTitle>Site menu</SheetTitle>
        <a href="/articles">Articles</a>
        <a href="https://example.com/donate" target="_blank" rel="noopener noreferrer">
          Donate
        </a>
        <button type="button">Search</button>
      </SheetContent>
    </MenuSheet>,
  )
}

function openSheet(): void {
  const trigger = screen.getByRole("button", { name: "Menu" })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.pointerUp(trigger, { button: 0 })
  fireEvent.click(trigger)
}

// The sheet's links load a page, which jsdom can't; the click is all that matters here.
function clickWithoutNavigating(element: HTMLElement): void {
  element.addEventListener("click", (event) => event.preventDefault())
  fireEvent.click(element)
}

afterEach(() => {
  cleanup()
})

describe("MenuSheet", () => {
  it("closes when a link inside it is clicked", async () => {
    renderSheet()
    openSheet()

    clickWithoutNavigating(await screen.findByRole("link", { name: "Articles" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("closes for a link that opens a new tab, which leaves the page underneath", async () => {
    renderSheet()
    openSheet()

    clickWithoutNavigating(await screen.findByRole("link", { name: "Donate" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("stays open when something other than a link is clicked", async () => {
    renderSheet()
    openSheet()

    fireEvent.click(await screen.findByRole("button", { name: "Search" }))

    expect(screen.getByRole("dialog", { name: "Site menu" })).toBeInTheDocument()
  })
})
