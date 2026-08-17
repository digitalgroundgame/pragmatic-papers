import type { User } from "@/payload-types"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { AuthorByline } from "../AuthorByline"

// This project doesn't enable vitest `globals`, so RTL never registers its
// automatic cleanup — without this every render piles up in the same document
// and `screen` queries start matching earlier tests' markup.
afterEach(cleanup)

const makeAuthor = (id: number, name: string): User =>
  ({ id, name, slug: name.toLowerCase().replace(/\s+/g, "-"), profileImage: null }) as User

const FOUR = [
  makeAuthor(1, "Alice Smith"),
  makeAuthor(2, "Bob Jones"),
  makeAuthor(3, "Carol Diaz"),
  makeAuthor(4, "Dan Reed"),
]

const avatarCount = (container: HTMLElement): number =>
  container.querySelectorAll('[data-slot="avatar"]').length

describe("AuthorByline", () => {
  it("renders nothing without authors", () => {
    const { container } = render(<AuthorByline authors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("names every author when they fit, with no toggle", () => {
    const { container } = render(<AuthorByline authors={FOUR.slice(0, 3)} />)
    expect(container.textContent).toContain("Alice Smith, Bob Jones & Carol Diaz")
    expect(screen.queryByRole("button")).toBe(null)
  })

  it("collapses past the cap into a remainder button", () => {
    const { container } = render(<AuthorByline authors={FOUR} />)
    expect(container.textContent).toContain("Alice Smith, Bob Jones & 2 more")
    expect(screen.getByRole("button", { name: "2 more" }).getAttribute("aria-expanded")).toBe(
      "false",
    )
  })

  it("reveals every name and avatar when the remainder is clicked", () => {
    const { container } = render(<AuthorByline authors={FOUR} />)
    expect(avatarCount(container)).toBe(2)

    fireEvent.click(screen.getByRole("button", { name: "2 more" }))

    expect(container.textContent).toContain("Alice Smith, Bob Jones, Carol Diaz & Dan Reed")
    expect(avatarCount(container)).toBe(4)
    expect(container.querySelector('[data-slot="avatar-group-count"]')).toBe(null)
  })

  it("expands from the +N badge too", () => {
    const { container } = render(<AuthorByline authors={FOUR} />)

    fireEvent.click(screen.getByRole("button", { name: "Show all 4 authors" }))

    expect(container.textContent).toContain("Dan Reed")
    expect(avatarCount(container)).toBe(4)
  })

  it("collapses again from Show less", () => {
    const { container } = render(<AuthorByline authors={FOUR} />)
    fireEvent.click(screen.getByRole("button", { name: "2 more" }))

    const showLess = screen.getByRole("button", { name: "Show less" })
    expect(showLess.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(showLess)

    expect(container.textContent).toContain("Alice Smith, Bob Jones & 2 more")
    expect(avatarCount(container)).toBe(2)
  })

  it("links every name it shows, expanded or not", () => {
    render(<AuthorByline authors={FOUR} />)
    expect(screen.getByRole("link", { name: "Alice Smith" }).getAttribute("href")).toBe(
      "/authors/alice-smith",
    )

    fireEvent.click(screen.getByRole("button", { name: "2 more" }))

    expect(screen.getByRole("link", { name: "Dan Reed" }).getAttribute("href")).toBe(
      "/authors/dan-reed",
    )
  })
})
