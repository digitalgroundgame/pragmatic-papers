import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as MediaModule from "@/components/Media"
import type { AudioMediaType } from "@/components/Media"
import type { User } from "@/payload-types"
import { NarrationPlayer } from "../index"

vi.mock("@/components/Media", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaModule>()),
  Media: ({ media }: { media: { filename: string } }) => (
    <div data-testid="media">{media?.filename}</div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const narration = {
  id: 20,
  filename: "narration.mp3",
  mimeType: "audio/mpeg",
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
} as AudioMediaType

const narrator = { id: 5, name: "Ada", slug: "ada" } as User

describe("NarrationPlayer", () => {
  it("renders the audio player", () => {
    render(<NarrationPlayer narration={narration} />)
    expect(screen.getByTestId("media").textContent).toBe("narration.mp3")
  })

  it("credits a resolved narrator", () => {
    render(<NarrationPlayer narration={{ ...narration, narrator }} />)
    const link = screen.getByRole("link", { name: "Ada" }) as HTMLAnchorElement
    expect(link.href).toContain("/authors/ada")
  })

  it("omits the credit without warning when no narrator is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    render(<NarrationPlayer narration={narration} />)
    expect(screen.queryByRole("link")).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it("warns when the narrator relationship was not resolved", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    render(<NarrationPlayer narration={{ ...narration, narrator: 5 }} />)
    expect(screen.queryByRole("link")).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("was not resolved"))
  })

  it("warns when a resolved narrator has no slug", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    render(<NarrationPlayer narration={{ ...narration, narrator: { ...narrator, slug: "" } }} />)
    expect(screen.queryByRole("link")).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing a slug"))
  })

  it("warns when a resolved narrator has no name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    render(<NarrationPlayer narration={{ ...narration, narrator: { ...narrator, name: null } }} />)
    expect(screen.queryByRole("link")).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing a name"))
  })
})
