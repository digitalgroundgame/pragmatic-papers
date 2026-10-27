import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

let pathname: string | null = "/"
vi.mock("next/navigation", () => ({ usePathname: () => pathname }))

import { HeaderTemplateSwitch, headerTemplateFor } from "../templates"

describe("headerTemplateFor", () => {
  it("gives the docs the minimal header, and their pages under /docs too", () => {
    expect(headerTemplateFor("/docs")).toBe("minimal")
    expect(headerTemplateFor("/docs/whats-new")).toBe("minimal")
    expect(headerTemplateFor("/docs/getting-started")).toBe("minimal")
  })

  it("gives every other route the default header", () => {
    expect(headerTemplateFor("/")).toBe("default")
    expect(headerTemplateFor("/articles/something")).toBe("default")
    // A sibling that only starts with the same letters isn't under /docs.
    expect(headerTemplateFor("/docsearch")).toBe("default")
    expect(headerTemplateFor(null)).toBe("default")
  })
})

describe("HeaderTemplateSwitch", () => {
  const templates = {
    default: <header>Default header</header>,
    minimal: <header>Minimal header</header>,
  }

  it("renders only the current route's template, and swaps it on navigation", () => {
    pathname = "/articles"
    const { rerender } = render(<HeaderTemplateSwitch templates={templates} />)
    expect(screen.getByText("Default header")).toBeInTheDocument()
    expect(screen.queryByText("Minimal header")).not.toBeInTheDocument()

    pathname = "/docs/whats-new"
    rerender(<HeaderTemplateSwitch templates={templates} />)
    expect(screen.getByText("Minimal header")).toBeInTheDocument()
    expect(screen.queryByText("Default header")).not.toBeInTheDocument()
  })
})
