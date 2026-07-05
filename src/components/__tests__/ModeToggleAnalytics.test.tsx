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

import { ModeToggleAnalytics } from "../ModeToggleAnalytics"

afterEach(() => {
  cleanup()
  setTheme.mockClear()
  sendGAEvent.mockClear()
})

describe("ModeToggleAnalytics", () => {
  it("reports the selected theme and location to GA", async () => {
    render(<ModeToggleAnalytics location="footer" />)
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))
    fireEvent.click(await screen.findByText("Dark"))
    expect(setTheme).toHaveBeenCalledWith("dark")
    expect(sendGAEvent).toHaveBeenCalledWith("event", "theme_change", {
      theme: "dark",
      location: "footer",
    })
  })

  it("reports an undefined location when none is given", async () => {
    render(<ModeToggleAnalytics />)
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))
    fireEvent.click(await screen.findByText("Light"))
    expect(sendGAEvent).toHaveBeenCalledWith("event", "theme_change", {
      theme: "light",
      location: undefined,
    })
  })
})
