import { sendGAEvent } from "@next/third-parties/google"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AudioMediaType } from "@/components/Media"
import type { User } from "@/payload-types"
import { NarrationPlayer } from "../index"

vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }))

// The credit only exists inside the player's settings panel, so these open the
// real panel rather than stubbing Media.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const narration = {
  id: 20,
  filename: "narration.mp3",
  mimeType: "audio/mpeg",
  url: "/media/narration.mp3",
  duration: 120,
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
} as AudioMediaType

const narrator = { id: 5, name: "Ada", slug: "ada" } as User

// The settings icon holding the credit is only revealed once the player has
// been expanded, so each case plays first and then opens the menu.
function openSettings(): void {
  fireEvent.click(screen.getByLabelText("Play"))
  fireEvent.click(screen.getByRole("button", { name: "Player settings" }))
}

describe("NarrationPlayer", () => {
  // The hero hands over whatever the CMS returned, so the guard lives here.
  describe("guards its input", () => {
    it("renders nothing without narration", () => {
      const { container } = render(<NarrationPlayer narration={null} />)
      expect(container).toBeEmptyDOMElement()
    })

    it("renders nothing for an unresolved relation", () => {
      const { container } = render(<NarrationPlayer narration={20} />)
      expect(container).toBeEmptyDOMElement()
    })

    it("renders nothing for a file that is not audio", () => {
      const { container } = render(
        <NarrationPlayer narration={{ ...narration, mimeType: "video/mp4" }} />,
      )
      expect(container).toBeEmptyDOMElement()
    })
  })

  it("passes its className to the player so callers can place it", () => {
    const { container } = render(<NarrationPlayer narration={narration} className="shrink-0" />)
    expect(container.firstElementChild).toHaveClass("shrink-0")
  })

  it("renders the audio player", () => {
    const { container } = render(<NarrationPlayer narration={narration} />)
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("/media/narration.mp3")
  })

  it("credits a resolved narrator with a link to their profile", () => {
    render(<NarrationPlayer narration={{ ...narration, narrator }} />)
    openSettings()

    expect(screen.getByRole("link", { name: "Ada" })).toHaveAttribute("href", "/contributors/ada")
    expect(screen.getByText("Narrated by")).toBeInTheDocument()
  })

  it("omits the credit when no narrator is set", () => {
    render(<NarrationPlayer narration={narration} />)
    openSettings()
    expect(screen.queryByText("Narrated by")).toBeNull()
  })

  it("omits the credit when the narrator relationship was not resolved", () => {
    render(<NarrationPlayer narration={{ ...narration, narrator: 5 }} />)
    openSettings()
    expect(screen.queryByText("Narrated by")).toBeNull()
  })

  it("omits the credit when a resolved narrator has no slug", () => {
    render(<NarrationPlayer narration={{ ...narration, narrator: { ...narrator, slug: "" } }} />)
    openSettings()
    expect(screen.queryByText("Narrated by")).toBeNull()
  })

  it("omits the credit when a resolved narrator has no name", () => {
    render(<NarrationPlayer narration={{ ...narration, narrator: { ...narrator, name: null } }} />)
    openSettings()
    expect(screen.queryByText("Narrated by")).toBeNull()
  })

  describe("reports plays", () => {
    beforeEach(() => vi.mocked(sendGAEvent).mockClear())

    it("sends one narration_play event per page, on the first play", async () => {
      render(<NarrationPlayer narration={narration} articleSlug="a-slug" />)

      fireEvent.click(screen.getByLabelText("Play"))
      await waitFor(() => expect(sendGAEvent).toHaveBeenCalledTimes(1))
      expect(sendGAEvent).toHaveBeenCalledWith("event", "narration_play", {
        content_type: "article",
        item_id: "a-slug",
      })

      fireEvent.click(await screen.findByLabelText("Pause"))
      fireEvent.click(await screen.findByLabelText("Play"))
      await waitFor(() => expect(screen.getByLabelText("Pause")).toBeInTheDocument())
      expect(sendGAEvent).toHaveBeenCalledTimes(1)
    })

    it("sends nothing when playback is blocked", async () => {
      vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("blocked"))
      render(<NarrationPlayer narration={narration} articleSlug="a-slug" />)

      fireEvent.click(screen.getByLabelText("Play"))
      await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled())
      await Promise.resolve()
      expect(sendGAEvent).not.toHaveBeenCalled()
    })
  })
})
