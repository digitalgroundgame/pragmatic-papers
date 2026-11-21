import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"

import type { BadgeInfo } from "@/plugins/comments"

import { AuthorBadges } from "../AuthorBadges"

const editor: BadgeInfo = { key: "editor", label: "Editor" }
const verified: BadgeInfo = { key: "vouched", label: "Verified" }
const earlyMember: BadgeInfo = { key: "early-member", label: "Early member" }

const renderBadges = (
  author: {
    badge: BadgeInfo | null
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
    renderBadges({ badge: editor, writer: true })
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "Editor"])
  })

  it("puts the newcomer's star between the writer's mark and their own badge", () => {
    renderBadges({ badge: verified, writer: true, newcomer: true })
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "New commenter", "Verified"])
    const star = screen.getByRole("img", { name: "New commenter" })
    expect(star.querySelector("svg")).toHaveClass("lucide-sparkles")
  })

  it("orders the markers that come and go between the writer's mark and the badge", () => {
    renderBadges({ badge: verified, writer: true, newcomer: true, newMember: true }, true)
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "First comment", "New commenter", "New member", "Verified"])
    expect(screen.getByRole("img", { name: "New member" }).querySelector("svg")).toHaveClass(
      "lucide-sprout",
    )
  })

  it("puts the cake right after the writer's mark on someone's cake day", () => {
    renderBadges({ badge: earlyMember, writer: true, cakeDay: true }, true)
    const names = screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))
    expect(names).toEqual(["Writer", "Cake day", "First comment", "Early member"])
    expect(screen.getByRole("img", { name: "Cake day" }).querySelector("svg")).toHaveClass(
      "lucide-cake",
    )
  })

  it("gives Early member the medal, keeping the star for new commenters", () => {
    renderBadges({ badge: earlyMember })
    const badge = screen.getByRole("img", { name: "Early member" })
    expect(badge.querySelector("svg")).toHaveClass("lucide-medal")
  })

  it("gives each staff role its own icon in the brand color", () => {
    renderBadges({ badge: { key: "chief-editor", label: "Chief editor" } })
    const badge = screen.getByRole("img", { name: "Chief editor" })
    expect(badge).toHaveClass("text-brand-text")
    expect(badge.querySelector("svg")).toHaveClass("lucide-crown")
  })

  it("colors each known badge its own way", () => {
    renderBadges({ badge: verified })
    expect(screen.getByRole("img", { name: "Verified" })).toHaveClass("text-blue-500")
  })

  it("gives an achievement without a look of its own the award icon", () => {
    renderBadges({ badge: { key: null, label: "Top commenter" } })
    const badge = screen.getByRole("img", { name: "Top commenter" })
    expect(badge.querySelector("svg")).toHaveClass("lucide-award")
  })

  it("keeps a badge's look by its key when editors rename it", () => {
    renderBadges({ badge: { key: "early-member", label: "Founding reader" } })
    const badge = screen.getByRole("img", { name: "Founding reader" })
    expect(badge.querySelector("svg")).toHaveClass("lucide-medal")
  })

  it("gives an unknown key the award icon, even one named like an object's own", () => {
    renderBadges({ badge: { key: "toString", label: "Odd one" } })
    const badge = screen.getByRole("img", { name: "Odd one" })
    expect(badge.querySelector("svg")).toHaveClass("lucide-award")
  })

  it("shows nothing for an author with no badge", () => {
    const { container } = renderBadges({ badge: null })
    expect(container).toBeEmptyDOMElement()
  })
})
