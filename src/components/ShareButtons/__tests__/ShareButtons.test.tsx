import { cleanup, fireEvent, render, screen, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@next/third-parties/google", () => ({
  sendGAEvent: vi.fn(),
}))

import { sendGAEvent } from "@next/third-parties/google"

import { ShareButtons } from "../index"

afterEach(cleanup)

const TEST_URL = "https://example.com/articles/test-slug"
const TEST_TITLE = "Test Article Title"

const PLATFORMS = [
  {
    name: "X",
    buttonLabel: "Share on X",
    urlFragment: "x.com/intent/tweet",
    expectedMethod: "x",
  },
  {
    name: "Bluesky",
    buttonLabel: "Share on Bluesky",
    urlFragment: "bsky.app/intent/compose",
    expectedMethod: "bluesky",
  },
  {
    name: "Facebook",
    buttonLabel: "Share on Facebook",
    urlFragment: "facebook.com/sharer",
    expectedMethod: "facebook",
  },
  {
    name: "Threads",
    buttonLabel: "Share on Threads",
    urlFragment: "threads.net/intent/post",
    expectedMethod: "threads",
  },
  {
    name: "Reddit",
    buttonLabel: "Share on Reddit",
    urlFragment: "reddit.com/submit",
    expectedMethod: "reddit",
  },
  {
    name: "LinkedIn",
    buttonLabel: "Share on LinkedIn",
    urlFragment: "linkedin.com/shareArticle",
    expectedMethod: "linkedin",
  },
  {
    name: "Email",
    buttonLabel: "Share via Email",
    urlFragment: "mailto:",
    expectedMethod: "email",
  },
]

describe("ShareButtons", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    vi.mocked(sendGAEvent).mockClear()
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
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument()
  })

  it("shows url input when open", () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    const input = screen.getByDisplayValue(TEST_URL) as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.readOnly).toBe(true)
  })

  it("copies url to clipboard when copy button is clicked", async () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL)
    expect(sendGAEvent).toHaveBeenCalledWith("event", "share", {
      method: "copy_link",
      content_type: "article",
      item_id: "test-slug",
    })
  })

  it("shows copied feedback after copying", async () => {
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument()
  })

  it("resets copied state after 2 seconds", async () => {
    vi.useFakeTimers()
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("does not show copied feedback when clipboard write fails", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copied!" })).not.toBeInTheDocument()
    expect(sendGAEvent).not.toHaveBeenCalled()
  })

  it("does not reset copied state early when clicked again before the first timeout fires", async () => {
    vi.useFakeTimers()
    render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copied!" }))
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it.each(PLATFORMS)(
    "$name share link has correct href and tracks a share event",
    ({ buttonLabel, urlFragment, expectedMethod }) => {
      render(<ShareButtons url={TEST_URL} title={TEST_TITLE} />)
      fireEvent.click(screen.getByRole("button", { name: "Share" }))
      const link = screen.getByRole("link", { name: buttonLabel }) as HTMLAnchorElement
      expect(link).toHaveAttribute("href", expect.stringContaining(urlFragment))
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))

      fireEvent.click(link)
      expect(sendGAEvent).toHaveBeenCalledWith("event", "share", {
        method: expectedMethod,
        content_type: "article",
        item_id: "test-slug",
      })
    },
  )

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

  it("derives volume content type from a volume url", () => {
    const volumeUrl = "https://example.com/volumes/test-volume-slug"
    render(<ShareButtons url={volumeUrl} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    fireEvent.click(screen.getByRole("link", { name: "Share on X" }))
    expect(sendGAEvent).toHaveBeenCalledWith("event", "share", {
      method: "x",
      content_type: "volume",
      item_id: "test-volume-slug",
    })
  })

  it("falls back to unknown content type when url matches neither pattern", () => {
    const unmatchedUrl = "https://example.com/"
    render(<ShareButtons url={unmatchedUrl} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    fireEvent.click(screen.getByRole("link", { name: "Share on X" }))
    expect(sendGAEvent).toHaveBeenCalledWith("event", "share", {
      method: "x",
      content_type: "unknown",
      item_id: null,
    })
  })
})
