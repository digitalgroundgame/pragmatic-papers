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

function isCollapsed(container: HTMLElement): boolean {
  return query(container, '[data-slot="audio-controls"]').hasAttribute("inert")
}

describe("AudioMedia", () => {
  it("renders nothing without a url", () => {
    const { container } = render(<AudioMedia media={{ ...media, url: null }} />)
    expect(container.firstChild).toBeNull()
  })

  it("starts collapsed with the controls inert", () => {
    const { container } = render(<AudioMedia media={media} />)
    expect(isCollapsed(container)).toBe(true)
  })

  it("expands when play is pressed", () => {
    const { container } = render(<AudioMedia media={media} />)
    fireEvent.click(screen.getByLabelText("Play"))
    expect(isCollapsed(container)).toBe(false)
  })

  it("stays expanded while paused", async () => {
    const { container } = render(<AudioMedia media={media} />)
    fireEvent.click(screen.getByLabelText("Play"))
    fireEvent.click(await screen.findByLabelText("Pause"))
    expect(screen.getByLabelText("Play")).toBeTruthy()
    expect(isCollapsed(container)).toBe(false)
  })

  it("collapses again once playback ends", () => {
    const { container } = render(<AudioMedia media={media} />)
    fireEvent.click(screen.getByLabelText("Play"))
    expect(isCollapsed(container)).toBe(false)

    fireEvent.ended(query<HTMLAudioElement>(container, "audio"))
    expect(isCollapsed(container)).toBe(true)
  })
})
