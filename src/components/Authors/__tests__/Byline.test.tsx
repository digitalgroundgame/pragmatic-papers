import type { BylineAuthor } from "@/components/Authors/BylineAuthor"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

/** Activate the way a keyboard user does: the control is focused first. */
const activate = (button: HTMLElement): void => {
  button.focus()
  fireEvent.click(button)
}

describe("Byline", () => {
  it("renders nothing without authors", () => {
    const { container } = render(<Byline authors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("names every author when they fit, with no toggle", () => {
    const { container } = render(<Byline authors={FOUR.slice(0, 3)} />)
    expect(container.textContent).toContain("Alice Smith, Bob Jones & Carol Diaz")
    expect(screen.queryByRole("button")).toBe(null)
  })

  it("collapses past the cap into a remainder button", () => {
    const { container } = render(<Byline authors={FOUR} />)
    expect(container.textContent).toContain("Alice Smith, Bob Jones & 2 more")
    expect(screen.getByRole("button", { name: "2 more" }).getAttribute("aria-expanded")).toBe(
      "false",
    )
  })

  it("points the toggle at the list of names it expands", () => {
    render(<Byline authors={FOUR} />)
    const controls = screen.getByRole("button", { name: "2 more" }).getAttribute("aria-controls")

    expect(controls).toBeTruthy()
    expect(document.getElementById(controls!)?.textContent).toContain("Alice Smith")
  })

  it("reveals every name and avatar when the remainder is clicked", () => {
    const { container } = render(<Byline authors={FOUR} />)
    expect(avatarCount(container)).toBe(2)

    fireEvent.click(screen.getByRole("button", { name: "2 more" }))

    expect(container.textContent).toContain("Alice Smith, Bob Jones, Carol Diaz & Dan Reed")
    expect(avatarCount(container)).toBe(4)
    expect(container.querySelector('[data-slot="avatar-group-count"]')).toBe(null)
  })

  it("expands from the +N badge too", () => {
    const { container } = render(<Byline authors={FOUR} />)

    fireEvent.click(screen.getByRole("button", { name: "Show all 4 authors" }))

    expect(container.textContent).toContain("Dan Reed")
    expect(avatarCount(container)).toBe(4)
  })

  it("collapses again from Show less", () => {
    const { container } = render(<Byline authors={FOUR} />)
    fireEvent.click(screen.getByRole("button", { name: "2 more" }))

    const showLess = screen.getByRole("button", { name: "Show less" })
    expect(showLess.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(showLess)

    expect(container.textContent).toContain("Alice Smith, Bob Jones & 2 more")
    expect(avatarCount(container)).toBe(2)
  })

  // WCAG 2.4.3: every control here replaces itself when activated, so without
  // a stable toggle a keyboard user lands on <body> and has to tab back down
  // the page to reach the byline again.
  it("keeps focus on the toggle across expanding and collapsing", () => {
    render(<Byline authors={FOUR} />)

    activate(screen.getByRole("button", { name: "2 more" }))
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show less" }))

    activate(screen.getByRole("button", { name: "Show less" }))
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2 more" }))
  })

  it("moves focus to the toggle when the +N badge expands the byline", () => {
    render(<Byline authors={FOUR} />)

    activate(screen.getByRole("button", { name: "Show all 4 authors" }))

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show less" }))
  })

  it("links every name it shows, expanded or not", () => {
    render(<Byline authors={FOUR} />)
    expect(screen.getByRole("link", { name: "Alice Smith" }).getAttribute("href")).toBe(
      "/authors/alice-smith",
    )

    fireEvent.click(screen.getByRole("button", { name: "2 more" }))

    expect(screen.getByRole("link", { name: "Dan Reed" }).getAttribute("href")).toBe(
      "/authors/dan-reed",
    )
  })
})
