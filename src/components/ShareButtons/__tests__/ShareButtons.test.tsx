import { cleanup, fireEvent, render, screen, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ShareButtons } from "../index"

afterEach(cleanup)

const TEST_URL = "https://example.com/articles/test-slug"
const TEST_TITLE = "Test Article Title"

const PLATFORMS = [
  { name: "X", buttonLabel: "Share on X", urlFragment: "x.com/intent/tweet" },
  { name: "Bluesky", buttonLabel: "Share on Bluesky", urlFragment: "bsky.app/intent/compose" },
  { name: "Facebook", buttonLabel: "Share on Facebook", urlFragment: "facebook.com/sharer" },
  { name: "Threads", buttonLabel: "Share on Threads", urlFragment: "threads.net/intent/post" },
  { name: "Reddit", buttonLabel: "Share on Reddit", urlFragment: "reddit.com/submit" },
  { name: "LinkedIn", buttonLabel: "Share on LinkedIn", urlFragment: "linkedin.com/shareArticle" },
  { name: "Email", buttonLabel: "Share via Email", urlFragment: "mailto:" },
]

describe("ShareButtons", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it("renders share trigger button", () => {
    const { container } = render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders share panel when open", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    expect(screen.getByRole("dialog")).toMatchSnapshot()
  })

  it("trigger button is accessible", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy()
  })

  it("shows url input when open", () => {
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

  it("resets copied state after 2 seconds", async () => {
    vi.useFakeTimers()
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy()
    vi.useRealTimers()
  })

  it.each(PLATFORMS)("$name share link has correct href", ({ buttonLabel, urlFragment }) => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    const link = screen.getByRole("link", { name: buttonLabel }) as HTMLAnchorElement
    expect(link.getAttribute("href")).toContain(urlFragment)
    expect(link.target).toBe("_blank")
    expect(link.rel).toContain("noopener")
  })

  it("encodes url and title in share links", () => {
    const specialUrl = "https://example.com/articles/test-with-spaces"
    const specialTitle = "Title with & special chars"
    render(<ShareButtons url={specialUrl} title={specialTitle} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    const link = screen.getByRole("link", { name: "Share on X" }) as HTMLAnchorElement
    const href = link.getAttribute("href") as string
    expect(href).not.toContain(" ")
    expect(href).toContain(encodeURIComponent(specialUrl))
  })
})
