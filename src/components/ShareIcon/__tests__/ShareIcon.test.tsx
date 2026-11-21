import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { isApplePlatform, ShareIcon } from ".."

const nav = (fields: Record<string, unknown>) => fields as unknown as Navigator

describe("isApplePlatform", () => {
  it("trusts the platform hint where the browser gives one", () => {
    expect(isApplePlatform(nav({ userAgentData: { platform: "macOS" } }))).toBe(true)
    expect(isApplePlatform(nav({ userAgentData: { platform: "iOS" } }))).toBe(true)
    expect(
      isApplePlatform(nav({ userAgentData: { platform: "Android" }, platform: "MacIntel" })),
    ).toBe(false)
  })

  it("reads the platform, or the user agent, where it doesn't", () => {
    expect(isApplePlatform(nav({ platform: "MacIntel" }))).toBe(true)
    expect(isApplePlatform(nav({ platform: "iPhone" }))).toBe(true)
    expect(
      isApplePlatform(nav({ platform: "", userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0)" })),
    ).toBe(true)
    expect(isApplePlatform(nav({ platform: "Win32" }))).toBe(false)
    expect(isApplePlatform(nav({ platform: "Linux armv8l" }))).toBe(false)
  })

  it("says no with no browser to ask", () => {
    expect(isApplePlatform(undefined)).toBe(false)
  })
})

describe("ShareIcon", () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows Apple's share icon on Apple devices", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel")
    const { container } = render(<ShareIcon />)
    expect(container.querySelector("svg")).toHaveClass("lucide-share")
  })

  it("shows the joined dots everywhere else", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32")
    const { container } = render(<ShareIcon />)
    expect(container.querySelector("svg")).toHaveClass("lucide-share-2")
  })
})
