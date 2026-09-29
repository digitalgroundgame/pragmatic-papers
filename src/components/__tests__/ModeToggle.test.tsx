import { ClientThemeProvider } from "@wrksz/themes/client"
import { cleanup, fireEvent, render, type RenderResult, screen } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FRESH, Fresh } from "../Fresh"
import { resetSeenStore, SEEN_KEY_PREFIX } from "../Fresh/store"
import { ModeToggle } from "../ModeToggle"

// Same provider props as src/app/(frontend)/layout.tsx. vitest.setup's
// matchMedia stub reports a light OS preference.
function renderToggle(props: React.ComponentProps<typeof ModeToggle> = {}): RenderResult {
  return render(
    <ClientThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ModeToggle {...props} />
    </ClientThemeProvider>,
  )
}

function openMenu(): void {
  const trigger = screen.getByRole("button", { name: "Toggle theme" })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.pointerUp(trigger, { button: 0 })
  fireEvent.click(trigger)
}

async function pick(theme: "Light" | "Dark" | "System"): Promise<void> {
  openMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: theme }))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.className = ""
})

describe("ModeToggle", () => {
  it("offers Light, Dark and System", async () => {
    renderToggle()
    openMenu()

    const items = await screen.findAllByRole("menuitem")
    expect(items.map((item) => item.textContent)).toEqual(["Light", "Dark", "System"])
  })

  it("hides the trigger label unless showLabel is set", () => {
    const { unmount } = renderToggle()
    expect(screen.getByText("Toggle theme")).toHaveClass("sr-only")
    unmount()

    renderToggle({ showLabel: true })
    expect(screen.getByText("Toggle theme")).not.toHaveClass("sr-only")
  })

  it("applies and remembers Dark", async () => {
    renderToggle()
    await pick("Dark")

    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("dark")
  })

  it("switches from Dark back to Light", async () => {
    renderToggle()
    await pick("Dark")
    await pick("Light")

    expect(document.documentElement).toHaveClass("light")
    expect(document.documentElement).not.toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("light")
  })

  it("follows the OS preference on System", async () => {
    renderToggle()
    await pick("Dark")
    await pick("System")

    expect(localStorage.getItem("theme")).toBe("system")
    expect(document.documentElement).toHaveClass("light")
    expect(document.documentElement).not.toHaveClass("dark")
  })

  it("reports each explicit switch to onThemeChange", async () => {
    const onThemeChange = vi.fn()
    renderToggle({ onThemeChange })
    await pick("Dark")
    await pick("System")

    expect(onThemeChange.mock.calls).toEqual([["dark"], ["system"]])
  })

  it("disables the option matching the current theme, System by default", async () => {
    const onThemeChange = vi.fn()
    renderToggle({ onThemeChange })
    openMenu()

    const system = await screen.findByRole("menuitem", { name: "System" })
    expect(system).toHaveAttribute("data-disabled")
    fireEvent.click(system)
    expect(onThemeChange).not.toHaveBeenCalled()
  })
})

describe("ModeToggle fresh dot", () => {
  function dotIn(element: HTMLElement): Element | null {
    return element.querySelector("[data-slot='fresh']")
  }

  // The header's account button mirrors the toggle's fresh dot below lg.
  function renderWithAccountButton(props: React.ComponentProps<typeof ModeToggle> = {}): void {
    render(
      <ClientThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <button type="button" className="relative">
          Account
          <Fresh name={FRESH.modeToggle} />
        </button>
        <ModeToggle {...props} />
      </ClientThemeProvider>,
    )
  }

  beforeEach(resetSeenStore)

  it("shows no dot unless showFresh is set", () => {
    renderToggle()

    expect(dotIn(screen.getByRole("button", { name: "Toggle theme" }))).not.toBeInTheDocument()
  })

  it("marks a first-time reader's toggle, and the places mirroring it", () => {
    renderWithAccountButton({ showFresh: true })

    expect(dotIn(screen.getByRole("button", { name: "Toggle theme" }))).toBeInTheDocument()
    expect(dotIn(screen.getByRole("button", { name: "Account" }))).toBeInTheDocument()
  })

  it("clears the dot everywhere once a toggle is opened, and remembers it", async () => {
    renderWithAccountButton({ showFresh: true })

    openMenu()
    await screen.findByRole("menuitem", { name: "Dark" })

    expect(dotIn(screen.getByRole("button", { name: "Toggle theme" }))).not.toBeInTheDocument()
    expect(dotIn(screen.getByRole("button", { name: "Account" }))).not.toBeInTheDocument()
    expect(localStorage.getItem(`${SEEN_KEY_PREFIX}${FRESH.modeToggle}`)).toBe("1")
  })

  it("is cleared by opening a toggle that doesn't show it, like the footer's", async () => {
    renderWithAccountButton()

    openMenu()
    await screen.findByRole("menuitem", { name: "Dark" })

    expect(dotIn(screen.getByRole("button", { name: "Account" }))).not.toBeInTheDocument()
  })
})
