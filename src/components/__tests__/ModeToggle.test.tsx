import { ClientThemeProvider } from "@wrksz/themes/client"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ModeToggle } from "../ModeToggle"

// Same provider props as src/app/(frontend)/layout.tsx. vitest.setup's
// matchMedia stub reports a light OS preference.
function renderToggle(): void {
  render(
    <ClientThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ModeToggle />
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
})
