import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AudioMediaType } from "@/components/Media"
import type { User } from "@/payload-types"
import { NarrationPlayer } from "../index"

// The credit only exists inside the player's settings menu, so these drive the
// real menu rather than stubbing Media — menu parts throw outside a Menu.Root.
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

// Settings live on the play button itself: right-click (and the keyboard's
// context-menu key) open them, a plain click plays.
function openSettings(): void {
  fireEvent.contextMenu(screen.getByLabelText("Play"))
}

describe("NarrationPlayer", () => {
  it("renders the audio player", () => {
    const { container } = render(<NarrationPlayer narration={narration} />)
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("/media/narration.mp3")
  })

  it("credits a resolved narrator with a link to their profile", () => {
    render(<NarrationPlayer narration={{ ...narration, narrator }} />)
    openSettings()

    const link = screen.getByRole("menuitem", { name: "Ada" }) as HTMLAnchorElement
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("/authors/ada")
    expect(screen.getByText("Narrated by")).toBeTruthy()
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
})
