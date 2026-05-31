import { cleanup, fireEvent, render, screen, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ShareButtons } from "../index"

afterEach(cleanup)

const TEST_URL = "https://example.com/articles/test-slug"
const TEST_TITLE = "Test Article Title"

describe("ShareButtons", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    vi.stubGlobal("open", vi.fn())
  })

  it("renders share trigger button", () => {
    const { container } = render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("trigger button is accessible", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy()
  })

  it("opens popover and shows url input on trigger click", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    const input = screen.getByDisplayValue(TEST_URL) as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.readOnly).toBe(true)
  })

  it("copies url to clipboard when copy button is clicked", async () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL)
  })

  it("shows copied feedback after copying", async () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull()
  })

  it("opens X share link in new window", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    fireEvent.click(screen.getByRole("button", { name: "Share on X" }))
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("x.com/intent/tweet"),
      "_blank",
      "noopener,noreferrer",
    )
  })

  it("opens Bluesky share link in new window", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    fireEvent.click(screen.getByRole("button", { name: "Share on Bluesky" }))
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("bsky.app/intent/compose"),
      "_blank",
      "noopener,noreferrer",
    )
  })

  it("opens email share link", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    fireEvent.click(screen.getByRole("button", { name: "Share via Email" }))
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("mailto:"),
      "_blank",
      "noopener,noreferrer",
    )
  })

  it("encodes url and title in share links", () => {
    const specialUrl = "https://example.com/articles/test-with-spaces"
    const specialTitle = "Title with & special chars"
    render(<ShareButtons url={specialUrl} title={specialTitle} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    fireEvent.click(screen.getByRole("button", { name: "Share on X" }))
    const openCall = vi.mocked(window.open).mock.calls[0]?.[0] as string
    expect(openCall).not.toContain(" ")
    expect(openCall).toContain(encodeURIComponent(specialUrl))
  })
})
