import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AudioMedia } from "../AudioMedia"
import type { AudioMediaType } from "../types"

const media = {
  id: 20,
  filename: "narration.mp3",
  mimeType: "audio/mpeg",
  url: "/media/narration.mp3",
  duration: 120,
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
} as AudioMediaType

// jsdom stubs play/pause as unimplemented, so drive them by hand.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function query<T extends Element>(container: HTMLElement, selector: string): T {
  const el = container.querySelector<T>(selector)
  if (!el) throw new Error(`${selector} not found`)
  return el
}

// The menu renders in a portal, so it is queried off the document rather than
// the render container.
function volumeSlider(): Element | null {
  return document.querySelector('[data-slot="slider"][aria-label="Volume"]')
}

/** Base UI backs each slider with a range input, the only handle jsdom can drive. */
function sliderInput(root: ParentNode, label: string): HTMLInputElement {
  const input = root
    .querySelector(`[data-slot="slider"][aria-label="${label}"]`)
    ?.querySelector("input")
  if (!input) throw new Error(`${label} slider not found`)
  return input
}

function isCollapsed(container: HTMLElement): boolean {
  return query(container, '[data-slot="audio-controls"]').hasAttribute("inert")
}

describe("AudioMedia", () => {
  it("renders nothing without a url", () => {
    const { container } = render(<AudioMedia media={{ ...media, url: null }} />)
    expect(container.firstChild).toBeNull()
  })

  describe("default variant", () => {
    it("shows the controls without any interaction", () => {
      const { container } = render(<AudioMedia media={media} />)
      expect(isCollapsed(container)).toBe(false)
    })

    it("keeps the controls open after playback ends", () => {
      const { container } = render(<AudioMedia media={media} />)
      fireEvent.click(screen.getByLabelText("Play"))
      fireEvent.ended(query<HTMLAudioElement>(container, "audio"))
      expect(isCollapsed(container)).toBe(false)
    })
  })

  describe("collapsible variant", () => {
    it("labels the collapsed player with a call to action and the duration", () => {
      render(<AudioMedia media={media} variant="collapsible" />)
      expect(screen.getByText("Listen \u00b7 2:00")).toBeTruthy()
    })

    it("falls back to a bare call to action when the duration is unknown", () => {
      render(<AudioMedia media={{ ...media, duration: null }} variant="collapsible" />)
      expect(screen.getByText("Listen")).toBeTruthy()
    })

    it("omits the call to action on the default variant", () => {
      render(<AudioMedia media={media} />)
      expect(screen.queryByText(/^Listen/)).toBeNull()
    })

    it("starts collapsed with the controls inert", () => {
      const { container } = render(<AudioMedia media={media} variant="collapsible" />)
      expect(isCollapsed(container)).toBe(true)
    })

    it("expands when play is pressed", () => {
      const { container } = render(<AudioMedia media={media} variant="collapsible" />)
      fireEvent.click(screen.getByLabelText("Play"))
      expect(isCollapsed(container)).toBe(false)
    })

    it("stays expanded while paused", async () => {
      const { container } = render(<AudioMedia media={media} variant="collapsible" />)
      fireEvent.click(screen.getByLabelText("Play"))
      fireEvent.click(await screen.findByLabelText("Pause"))
      expect(screen.getByLabelText("Play")).toBeTruthy()
      expect(isCollapsed(container)).toBe(false)
    })

    it("collapses again once playback ends", () => {
      const { container } = render(<AudioMedia media={media} variant="collapsible" />)
      fireEvent.click(screen.getByLabelText("Play"))
      expect(isCollapsed(container)).toBe(false)

      fireEvent.ended(query<HTMLAudioElement>(container, "audio"))
      expect(isCollapsed(container)).toBe(true)
    })
  })

  it("stays paused when the browser refuses to play", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("blocked"))

    const { container } = render(<AudioMedia media={media} variant="collapsible" />)
    fireEvent.click(screen.getByLabelText("Play"))

    // The controls still open — the press was a real intent to listen.
    expect(await screen.findByLabelText("Play")).toBeInTheDocument()
    expect(isCollapsed(container)).toBe(false)
  })

  describe("scrubber", () => {
    it("reads out the position against the duration", () => {
      const { container } = render(<AudioMedia media={media} />)
      const audio = query<HTMLAudioElement>(container, "audio")
      expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument()

      audio.currentTime = 65
      fireEvent.timeUpdate(audio)
      expect(screen.getByText("1:05 / 2:00")).toBeInTheDocument()
    })

    it("seeks the audio element when dragged", () => {
      const { container } = render(<AudioMedia media={media} />)
      const audio = query<HTMLAudioElement>(container, "audio")

      fireEvent.change(sliderInput(container, "Seek"), { target: { value: "42" } })
      expect(audio.currentTime).toBe(42)
      expect(screen.getByText("0:42 / 2:00")).toBeInTheDocument()
    })

    it("parks the readout at the end when playback finishes", () => {
      const { container } = render(<AudioMedia media={media} />)
      fireEvent.ended(query<HTMLAudioElement>(container, "audio"))
      expect(screen.getByText("2:00 / 2:00")).toBeInTheDocument()
    })

    it("falls back to a placeholder range until the duration is known", () => {
      const { container } = render(<AudioMedia media={{ ...media, duration: null }} />)
      // A zero-length range would pin the thumb; 100 keeps it draggable.
      expect(sliderInput(container, "Seek")).toHaveAttribute("max", "100")
      expect(screen.getByText("0:00 / 0:00")).toBeInTheDocument()
    })
  })

  // A file whose header carries no duration reports Infinity, and the player
  // has to go find the real end. These stub the element's read-only media
  // properties, which jsdom leaves unimplemented.
  describe("duration discovery", () => {
    function stubMediaProperty(name: "duration" | "readyState", value: number): void {
      vi.spyOn(HTMLMediaElement.prototype, name, "get").mockReturnValue(value)
    }

    it("takes the duration the element already has at mount", () => {
      stubMediaProperty("readyState", 1)
      stubMediaProperty("duration", 200)

      render(<AudioMedia media={{ ...media, duration: null }} />)
      expect(screen.getByText("0:00 / 3:20")).toBeInTheDocument()
    })

    it("seeks past the end to force a headerless file to report its length", () => {
      stubMediaProperty("duration", Infinity)

      const { container } = render(<AudioMedia media={{ ...media, duration: null }} />)
      const audio = query<HTMLAudioElement>(container, "audio")
      fireEvent.loadedMetadata(audio)
      expect(audio.currentTime).toBe(1e9)

      // The browser answers with a real duration; the player rewinds the seek.
      vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(300)
      fireEvent.durationChange(audio)
      expect(audio.currentTime).toBe(0)
      expect(screen.getByText("0:00 / 5:00")).toBeInTheDocument()
    })

    it("leaves a stored duration alone rather than seeking for it", () => {
      stubMediaProperty("duration", Infinity)

      const { container } = render(<AudioMedia media={media} />)
      const audio = query<HTMLAudioElement>(container, "audio")
      fireEvent.loadedMetadata(audio)
      expect(audio.currentTime).toBe(0)
      expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument()
    })

    it("reports the duration it settles on to the caller", () => {
      const onDurationChange = vi.fn()
      const { container } = render(<AudioMedia media={media} onDurationChange={onDurationChange} />)

      vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(90)
      fireEvent.durationChange(query<HTMLAudioElement>(container, "audio"))
      expect(onDurationChange).toHaveBeenLastCalledWith(90)
    })

    it("ignores a durationchange that still has no length to give", () => {
      vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(NaN)

      const { container } = render(<AudioMedia media={media} />)
      fireEvent.durationChange(query<HTMLAudioElement>(container, "audio"))
      expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument()
    })
  })

  describe("settings menu", () => {
    it("changes the playback rate of the audio element", () => {
      const { container } = render(<AudioMedia media={media} />)
      const audio = query<HTMLAudioElement>(container, "audio")
      expect(audio.playbackRate).toBe(1)

      fireEvent.click(screen.getByLabelText("Player settings"))
      fireEvent.click(screen.getByRole("menuitemradio", { name: "1.5\u00d7" }))
      expect(audio.playbackRate).toBe(1.5)
    })

    it("offers a volume slider", () => {
      const { container } = render(<AudioMedia media={media} />)
      expect(query<HTMLAudioElement>(container, "audio").volume).toBe(1)

      fireEvent.click(screen.getByLabelText("Player settings"))
      expect(volumeSlider()).not.toBeNull()
    })

    it("keeps the volume it was given", () => {
      render(<AudioMedia media={media} />)
      fireEvent.click(screen.getByLabelText("Player settings"))

      const volume = sliderInput(document, "Volume")
      expect(volume.value).toBe("1")

      fireEvent.change(volume, { target: { value: "0.25" } })
      expect(sliderInput(document, "Volume").value).toBe("0.25")
    })

    it("is only revealed once the collapsible variant has been played", () => {
      const { container } = render(<AudioMedia media={media} variant="collapsible" />)
      const settings = screen.getByLabelText("Player settings")
      // Present but clipped and inert, so it cannot be reached while collapsed.
      expect(isCollapsed(container)).toBe(true)
      expect(settings.closest("[inert]")).not.toBeNull()

      fireEvent.click(screen.getByLabelText("Play"))
      expect(isCollapsed(container)).toBe(false)
      expect(settings.closest("[inert]")).toBeNull()
    })
  })
})
