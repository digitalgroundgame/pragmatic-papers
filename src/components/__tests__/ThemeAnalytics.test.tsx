import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const sendGAEvent = vi.fn()
vi.mock("@next/third-parties/google", () => ({
  sendGAEvent: (...args: unknown[]) => sendGAEvent(...args),
}))

let resolvedTheme: string | undefined = "light"
vi.mock("@wrksz/themes/client", () => ({
  useTheme: () => ({ resolvedTheme }),
}))

import { ThemeAnalytics } from "../ThemeAnalytics"

afterEach(() => {
  cleanup()
  sendGAEvent.mockClear()
  resolvedTheme = "light"
})

describe("ThemeAnalytics", () => {
  it("reports the resolved theme on mount", () => {
    render(<ThemeAnalytics />)
    expect(sendGAEvent).toHaveBeenCalledWith("event", "theme_preference", { theme: "light" })
  })

  it("does not report when the theme hasn't resolved yet", () => {
    resolvedTheme = undefined
    render(<ThemeAnalytics />)
    expect(sendGAEvent).not.toHaveBeenCalled()
  })

  it("reports again when the resolved theme changes", () => {
    resolvedTheme = "dark"
    render(<ThemeAnalytics />)
    expect(sendGAEvent).toHaveBeenCalledWith("event", "theme_preference", { theme: "dark" })
  })
})
