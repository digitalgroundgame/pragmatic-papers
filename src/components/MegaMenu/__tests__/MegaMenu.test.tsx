import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { MenuField } from "@/payload-types"

import { MegaMenu } from ".."

vi.mock("next/navigation", () => ({
  usePathname: () => "/authors/e2e-writer",
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

describe("MegaMenu", () => {
  it("marks the link for the current section as the active page", () => {
    render(<MegaMenu menu={menu} />)

    const authors = screen.getByRole("link", { name: "Authors" })
    expect(authors).toHaveAttribute("aria-current", "page")
    expect(authors).toHaveAttribute("data-active")

    const home = screen.getByRole("link", { name: "Home" })
    expect(home).not.toHaveAttribute("aria-current")
    expect(home).not.toHaveAttribute("data-active")
  })

  it("skips items whose link does not resolve to a URL", () => {
    render(<MegaMenu menu={menu} />)

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByText("Deleted page")).not.toBeInTheDocument()
  })
})
