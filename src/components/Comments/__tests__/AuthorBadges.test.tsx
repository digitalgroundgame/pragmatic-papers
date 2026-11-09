import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"

import { AuthorBadges } from "../AuthorBadges"

const renderBadges = (author: { badge: string | null; writer?: true }) =>
  render(
    <TooltipProvider>
      <AuthorBadges author={author} />
    </TooltipProvider>,
  )

describe("AuthorBadges", () => {
  it("shows the writer's mark first, then the author's own badge, each named", () => {
    renderBadges({ badge: "Staff", writer: true })
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "Staff"])
  })

  it("colors each known badge its own way", () => {
    renderBadges({ badge: "Verified" })
    expect(screen.getByRole("img", { name: "Verified" })).toHaveClass("text-emerald-600")
  })

  it("gives an achievement without a look of its own the award icon", () => {
    renderBadges({ badge: "Top commenter" })
    const badge = screen.getByRole("img", { name: "Top commenter" })
    expect(badge.querySelector("svg")).toHaveClass("lucide-award")
  })

  it("shows nothing for an author with no badge", () => {
    const { container } = renderBadges({ badge: null })
    expect(container).toBeEmptyDOMElement()
  })
})
