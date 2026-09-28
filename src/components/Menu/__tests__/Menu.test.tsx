import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { MenuField } from "@/payload-types"

import { Menu } from ".."

vi.mock("next/navigation", () => ({
  usePathname: () => "/authors",
}))

afterEach(cleanup)

const menu: MenuField = [
  { id: "home", link: { type: "custom", label: "Home", url: "/" } },
  { id: "authors", link: { type: "custom", label: "Authors", url: "/authors" } },
  {
    id: "unresolved",
    link: {
      type: "reference",
      label: "Deleted page",
      reference: { relationTo: "pages", value: 42 },
    },
  },
]

describe("Menu", () => {
  it("marks the current page in the stacked sidebar layout", () => {
    render(<Menu menu={menu} layout="stacked" />)

    const authors = screen.getByRole("link", { name: "Authors" })
    expect(authors).toHaveAttribute("aria-current", "page")
    expect(authors).toHaveClass("data-active:bg-muted")
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current")
  })

  it("skips items whose link does not resolve to a URL", () => {
    render(<Menu menu={menu} />)

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByText("Deleted page")).not.toBeInTheDocument()
  })
})
