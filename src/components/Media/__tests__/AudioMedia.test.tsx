import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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
// the render container. jsdom gives the slider no layout, so these assert that
// the control is mounted rather than trying to drag it.
function volumeSlider(): Element | null {
  return document.querySelector('[data-slot="slider"][aria-label="Volume"]')
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

  describe("settings menu", () => {
    it("does not open on a plain click, which plays instead", () => {
      const { container } = render(<AudioMedia media={media} />)
      fireEvent.click(screen.getByLabelText("Play"))

      expect(volumeSlider()).toBeNull()
      expect(isCollapsed(container)).toBe(false)
    })

    it("opens from a right-click on the play button without toggling playback", () => {
      render(<AudioMedia media={media} />)
      fireEvent.contextMenu(screen.getByLabelText("Play"))

      expect(volumeSlider()).not.toBeNull()
      expect(screen.getByLabelText("Play")).toBeTruthy()
    })

    it("opens on a long press and swallows the click that ends it", () => {
      vi.useFakeTimers()
      try {
        const { container } = render(<AudioMedia media={media} variant="collapsible" />)
        const play = screen.getByLabelText("Play")

        fireEvent.pointerDown(play, { button: 0 })
        act(() => vi.advanceTimersByTime(600))
        fireEvent.pointerUp(play)
        fireEvent.click(play)

        expect(volumeSlider()).not.toBeNull()
        // The press opened settings, so it must not have started playback.
        expect(isCollapsed(container)).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it("does not open when the press is released early", () => {
      vi.useFakeTimers()
      try {
        const { container } = render(<AudioMedia media={media} variant="collapsible" />)
        const play = screen.getByLabelText("Play")

        fireEvent.pointerDown(play, { button: 0 })
        act(() => vi.advanceTimersByTime(200))
        fireEvent.pointerUp(play)
        fireEvent.click(play)

        expect(volumeSlider()).toBeNull()
        expect(isCollapsed(container)).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it("changes the playback rate of the audio element", () => {
      const { container } = render(<AudioMedia media={media} />)
      const audio = query<HTMLAudioElement>(container, "audio")
      expect(audio.playbackRate).toBe(1)

      fireEvent.contextMenu(screen.getByLabelText("Play"))
      fireEvent.click(screen.getByRole("menuitemradio", { name: "1.5\u00d7" }))
      expect(audio.playbackRate).toBe(1.5)
    })

    it("offers a volume slider", () => {
      const { container } = render(<AudioMedia media={media} />)
      expect(query<HTMLAudioElement>(container, "audio").volume).toBe(1)

      fireEvent.contextMenu(screen.getByLabelText("Play"))
      expect(volumeSlider()).not.toBeNull()
    })

    it("is reachable while the collapsible variant is still collapsed", () => {
      const { container } = render(<AudioMedia media={media} variant="collapsible" />)
      expect(isCollapsed(container)).toBe(true)

      fireEvent.contextMenu(screen.getByLabelText("Play"))
      expect(volumeSlider()).not.toBeNull()
      expect(isCollapsed(container)).toBe(true)
    })
  })
})
