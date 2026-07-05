import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const setTheme = vi.fn()
let theme: string | undefined
vi.mock("@wrksz/themes/client", () => ({
  useTheme: () => ({ setTheme, theme }),
}))

import { ModeToggle } from "../ModeToggle"

afterEach(() => {
  cleanup()
  setTheme.mockClear()
  theme = undefined
})

describe("ModeToggle", () => {
  it("renders the compact icon toggle by default", () => {
    render(<ModeToggle />)
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeDefined()
  })

  it("renders a full-width labeled trigger when showLabel is set", () => {
    render(<ModeToggle showLabel />)
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeDefined()
  })

  it.each([
    ["Light", "light"],
    ["Dark", "dark"],
    ["System", "system"],
  ])("sets the %s theme when that option is selected", async (label, expectedTheme) => {
    const onThemeChange = vi.fn()
    render(<ModeToggle onThemeChange={onThemeChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))
    fireEvent.click(await screen.findByText(label))
    expect(setTheme).toHaveBeenCalledWith(expectedTheme)
    expect(onThemeChange).toHaveBeenCalledWith(expectedTheme)
  })

  it("works without an onThemeChange callback", async () => {
    render(<ModeToggle />)
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))
    fireEvent.click(await screen.findByText("Dark"))
    expect(setTheme).toHaveBeenCalledWith("dark")
  })

  it("disables the option matching the current theme", async () => {
    theme = "light"
    render(<ModeToggle />)
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))
    const lightOption = await screen.findByRole("menuitem", { name: "Light" })
    expect(lightOption.getAttribute("data-disabled")).not.toBeNull()

    fireEvent.click(lightOption)
    expect(setTheme).not.toHaveBeenCalled()
  })
})
