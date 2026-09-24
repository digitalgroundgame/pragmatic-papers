import { ClientThemeProvider } from "@wrksz/themes/client"
import { cleanup, fireEvent, render, type RenderResult, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ModeToggle } from "../ModeToggle"

// Same provider props as src/app/(frontend)/layout.tsx. vitest.setup's
// matchMedia stub reports a light OS preference.
function renderToggle(props: React.ComponentProps<typeof ModeToggle> = {}): RenderResult {
  return render(
    <ClientThemeProvider
      attribute="class"
      defaultTheme="light"
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

  it("disables the option matching the current theme", async () => {
    const onThemeChange = vi.fn()
    renderToggle({ onThemeChange })
    openMenu()

    const light = await screen.findByRole("menuitem", { name: "Light" })
    expect(light).toHaveAttribute("data-disabled")
    fireEvent.click(light)
    expect(onThemeChange).not.toHaveBeenCalled()
  })
})
