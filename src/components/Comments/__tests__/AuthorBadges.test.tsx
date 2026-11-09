import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"

import { AuthorBadges } from "../AuthorBadges"

const renderBadges = (
  author: {
    badge: string | null
    writer?: true
    newcomer?: true
    newMember?: true
    cakeDay?: true
  },
  firstComment = false,
) =>
  render(
    <TooltipProvider>
      <AuthorBadges author={author} firstComment={firstComment} />
    </TooltipProvider>,
  )

describe("AuthorBadges", () => {
  it("shows the writer's mark first, then the author's own badge, each named", () => {
    renderBadges({ badge: "Staff", writer: true })
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "Staff"])
  })

  it("puts the newcomer's star between the writer's mark and their own badge", () => {
    renderBadges({ badge: "Verified", writer: true, newcomer: true })
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "New commenter", "Verified"])
    const star = screen.getByRole("img", { name: "New commenter" })
    expect(star.querySelector("svg")).toHaveClass("lucide-sparkles")
  })

  it("orders the markers that come and go between the writer's mark and the badge", () => {
    renderBadges({ badge: "Verified", writer: true, newcomer: true, newMember: true }, true)
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "First comment", "New commenter", "New member", "Verified"])
    expect(screen.getByRole("img", { name: "New member" }).querySelector("svg")).toHaveClass(
      "lucide-sprout",
    )
  })

  it("puts the cake right after the writer's mark on someone's cake day", () => {
    renderBadges({ badge: "Early member", writer: true, cakeDay: true }, true)
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "Cake day", "First comment", "Early member"])
    expect(screen.getByRole("img", { name: "Cake day" }).querySelector("svg")).toHaveClass(
      "lucide-cake",
    )
  })

  it("gives Early member the medal, keeping the star for new commenters", () => {
    renderBadges({ badge: "Early member" })
    const badge = screen.getByRole("img", { name: "Early member" })
    expect(badge.querySelector("svg")).toHaveClass("lucide-medal")
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
