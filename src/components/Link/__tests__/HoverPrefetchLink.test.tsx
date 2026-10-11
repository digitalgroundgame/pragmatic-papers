import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as HoverPrefetchLinkModule from "../HoverPrefetchLink"

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: React.ComponentProps<"a"> & { prefetch?: boolean | null }) => (
    <a data-next-link data-prefetch={String(prefetch)} {...props} />
  ),
}))

async function load(clientNavigation: boolean): Promise<typeof HoverPrefetchLinkModule> {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_CLIENT_NAVIGATION", clientNavigation ? "true" : "")
  return import("../HoverPrefetchLink")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isClientRoute", () => {
  it("accepts paths on this site", async () => {
    const { isClientRoute } = await load(true)
    expect(isClientRoute("/")).toBe(true)
    expect(isClientRoute("/articles/a-slug")).toBe(true)
    expect(isClientRoute("/administrators")).toBe(true)
  })

  it("rejects URLs, hashes and the routes the Worker sends to the origin", async () => {
    const { isClientRoute } = await load(true)
    expect(isClientRoute("https://example.com/")).toBe(false)
    expect(isClientRoute("//example.com/")).toBe(false)
    expect(isClientRoute("#footnote-1")).toBe(false)
    expect(isClientRoute("/admin")).toBe(false)
    expect(isClientRoute("/admin/collections/articles")).toBe(false)
    expect(isClientRoute("/api/media/file/a.png")).toBe(false)
  })
})

describe("HoverPrefetchLink", () => {
  it("is a plain <a> without client navigation", async () => {
    const { HoverPrefetchLink } = await load(false)
    render(<HoverPrefetchLink href="/articles/a">A</HoverPrefetchLink>)
    const link = screen.getByRole("link", { name: "A" })
    expect(link).toHaveAttribute("href", "/articles/a")
    expect(link).not.toHaveAttribute("data-next-link")
  })

  it("uses next/link for site paths, prefetching only after hover", async () => {
    const { HoverPrefetchLink } = await load(true)
    const { fireEvent } = await import("@testing-library/react")
    const onMouseEnter = vi.fn()
    render(
      <HoverPrefetchLink href="/articles/a" onMouseEnter={onMouseEnter}>
        A
      </HoverPrefetchLink>,
    )
    const link = screen.getByRole("link", { name: "A" })
    expect(link).toHaveAttribute("data-next-link")
    expect(link).toHaveAttribute("data-prefetch", "false")
    fireEvent.mouseEnter(link)
    expect(link).toHaveAttribute("data-prefetch", "null")
    expect(onMouseEnter).toHaveBeenCalledOnce()
  })

  it("stays a plain <a> for external URLs, origin routes and new tabs", async () => {
    const { HoverPrefetchLink } = await load(true)
    render(
      <>
        <HoverPrefetchLink href="https://example.com/">External</HoverPrefetchLink>
        <HoverPrefetchLink href="/admin">Admin</HoverPrefetchLink>
        <HoverPrefetchLink href="/articles/a" target="_blank">
          New tab
        </HoverPrefetchLink>
      </>,
    )
    for (const name of ["External", "Admin", "New tab"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("data-next-link")
    }
  })
})
