import type { BylineAuthor } from "@/components/Authors/BylineAuthor"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Byline } from "../Byline"

// This project doesn't enable vitest `globals`, so RTL never registers its
// automatic cleanup — without this every render piles up in the same document
// and `screen` queries start matching earlier tests' markup.
afterEach(cleanup)

const makeAuthor = (id: number, name: string): BylineAuthor => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  avatarUrl: null,
})

const FOUR = [
  makeAuthor(1, "Alice Smith"),
  makeAuthor(2, "Bob Jones"),
  makeAuthor(3, "Carol Diaz"),
  makeAuthor(4, "Dan Reed"),
]

const avatarCount = (container: HTMLElement): number =>
  container.querySelectorAll('[data-slot="avatar"]').length

/**
 * The byline's prose, without the avatars — an avatar with no image renders
 * the author's initials, which would otherwise sit between the separators and
 * the names ("ASAlice Smith, BJBob Jones").
 */
const bylineText = (container: HTMLElement): string => {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-slot="avatar"]').forEach((avatar) => avatar.remove())
  return clone.textContent ?? ""
}

describe("Byline", () => {
  it("renders nothing without authors", () => {
    const { container } = render(<Byline authors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("names a pair with no comma", () => {
    const { container } = render(<Byline authors={FOUR.slice(0, 2)} />)
    expect(bylineText(container)).toBe("Alice Smith & Bob Jones")
  })

  it("names every author, however many, with no toggle", () => {
    const { container } = render(<Byline authors={FOUR} />)

    expect(bylineText(container)).toBe("Alice Smith, Bob Jones, Carol Diaz & Dan Reed")
    expect(screen.queryByRole("button")).toBe(null)
  })

  it("gives every author their own avatar", () => {
    const { container } = render(<Byline authors={FOUR} />)
    expect(avatarCount(container)).toBe(FOUR.length)
  })

  // The avatar sits inside the author's link, so the name is the link's whole
  // accessible name and each author is announced once (WCAG H2).
  it("links each author once, by name", () => {
    render(<Byline authors={FOUR} />)

    expect(screen.getAllByRole("link")).toHaveLength(FOUR.length)
    expect(screen.getByRole("link", { name: "Dan Reed" }).getAttribute("href")).toBe(
      "/authors/dan-reed",
    )
  })

  it("falls back to an initial for an unnamed author", () => {
    render(<Byline authors={[{ id: 1, name: null, slug: "anon", avatarUrl: null }]} />)
    expect(screen.getByText("A")).toBeTruthy()
  })
})
