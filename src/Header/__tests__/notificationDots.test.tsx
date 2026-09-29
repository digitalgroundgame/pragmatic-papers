import { ClientThemeProvider } from "@wrksz/themes/client"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ModeToggle } from "@/components/ModeToggle"
import { NotificationDot } from "@/components/NotificationDot"
import { SheetTitle } from "@/components/ui/sheet"
import { resetNotificationStore } from "@/providers/NotificationProvider"

import { SearchPanel } from "../SearchPanel"

// Base UI opens menus and sheets on the pointer sequence, not a bare click.
function press(element: HTMLElement): void {
  fireEvent.pointerDown(element, { button: 0, ctrlKey: false })
  fireEvent.pointerUp(element, { button: 0 })
  fireEvent.click(element)
}

function dotIn(element: HTMLElement): Element | null {
  return element.querySelector("[data-slot='notification-dot']")
}

beforeEach(() => {
  localStorage.clear()
  resetNotificationStore()
})

afterEach(() => {
  cleanup()
  document.documentElement.className = ""
})

describe("SearchPanel", () => {
  function renderPanel(): HTMLElement {
    render(
      <SearchPanel>
        <SheetTitle>Site menu</SheetTitle>
        <a href="/articles">Articles</a>
      </SearchPanel>,
    )
    return screen.getByRole("button", { name: "Menu" })
  }

  it("marks the menu button with a dot until it is first opened", async () => {
    const trigger = renderPanel()
    expect(dotIn(trigger)).toBeInTheDocument()
    expect(trigger).toHaveAttribute("data-tour", "search")

    press(trigger)

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Articles" })).toBeInTheDocument()
    expect(dotIn(trigger)).not.toBeInTheDocument()
    expect(localStorage.getItem("pp:seen:search")).toBe("1")
  })

  it("shows no dot to a reader who has already opened it", () => {
    localStorage.setItem("pp:seen:search", "1")

    expect(dotIn(renderPanel())).not.toBeInTheDocument()
  })
})

describe("theme selector dot", () => {
  function renderToggleAndAccountButton(): { toggle: HTMLElement; account: HTMLElement } {
    render(
      <ClientThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <button type="button" className="relative">
          Account
          <NotificationDot name="theme-selector" />
        </button>
        <ModeToggle />
      </ClientThemeProvider>,
    )
    return {
      toggle: screen.getByRole("button", { name: "Toggle theme" }),
      account: screen.getByRole("button", { name: "Account" }),
    }
  }

  it("shows on the toggle and the account button until the toggle is opened", async () => {
    const { toggle, account } = renderToggleAndAccountButton()
    expect(dotIn(toggle)).toBeInTheDocument()
    expect(dotIn(account)).toBeInTheDocument()

    press(toggle)
    await screen.findByRole("menuitem", { name: "Dark" })

    expect(dotIn(toggle)).not.toBeInTheDocument()
    expect(dotIn(account)).not.toBeInTheDocument()
    expect(localStorage.getItem("pp:seen:theme-selector")).toBe("1")
  })

  it("stays hidden after a reload once seen", () => {
    localStorage.setItem("pp:seen:theme-selector", "1")

    const { toggle, account } = renderToggleAndAccountButton()

    expect(dotIn(toggle)).not.toBeInTheDocument()
    expect(dotIn(account)).not.toBeInTheDocument()
  })
})
