import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const setTheme = vi.fn()
vi.mock("@wrksz/themes/client", () => ({
  useTheme: () => ({ setTheme }),
}))

const sendGAEvent = vi.fn()
vi.mock("@next/third-parties/google", () => ({
  sendGAEvent: (...args: unknown[]) => sendGAEvent(...args),
}))

import { ModeToggle } from "../ModeToggle"

afterEach(() => {
  cleanup()
  setTheme.mockClear()
  sendGAEvent.mockClear()
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
  ])("sets the %s theme when that option is selected", async (label, theme) => {
    render(<ModeToggle />)
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))
    fireEvent.click(await screen.findByText(label))
    expect(setTheme).toHaveBeenCalledWith(theme)
    expect(sendGAEvent).toHaveBeenCalledWith("event", "theme_change", { theme })
  })
})
