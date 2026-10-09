import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MenuLink } from "../MenuLink"

vi.mock("next/navigation", () => ({
  usePathname: () => "/contributors/e2e-writer",
}))

afterEach(cleanup)

describe("MenuLink", () => {
  it("marks the link for the current section as the active page", () => {
    render(<MenuLink href="/contributors" render={<a href="/contributors">Authors</a>} />)

    const link = screen.getByRole("link", { name: "Authors" })
    expect(link).toHaveAttribute("aria-current", "page")
    expect(link).toHaveAttribute("data-active")
  })

  it("leaves other links unmarked", () => {
    render(<MenuLink href="/" render={<a href="/">Home</a>} />)

    const link = screen.getByRole("link", { name: "Home" })
    expect(link).not.toHaveAttribute("aria-current")
    expect(link).not.toHaveAttribute("data-active")
  })
})
