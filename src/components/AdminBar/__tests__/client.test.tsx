import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { path } = vi.hoisted(() => ({ path: { value: "/" } }))

vi.mock("next/navigation", () => ({
  usePathname: () => path.value,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { AdminBarClient } from "../client"

const json = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response

function stubPayload({ user, docs = [] }: { user: unknown; docs?: unknown[] }) {
  const fetchMock = vi.fn(async (url: string) =>
    url.includes("/api/users/me") ? json({ user }) : json({ docs }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  path.value = "/"
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("AdminBarClient", () => {
  it("stays hidden, and looks nothing up, for a reader who isn't logged in", async () => {
    const fetchMock = stubPayload({ user: null })
    path.value = "/articles/some-story"
    const { container } = render(<AdminBarClient />)

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(container.firstElementChild).toHaveClass("hidden")
    expect(container.firstElementChild).toBeEmptyDOMElement()
  })

  it("links an editor to the document the page shows", async () => {
    const fetchMock = stubPayload({
      user: { id: "7", email: "ed@example.com" },
      docs: [{ id: 42 }],
    })
    path.value = "/articles/some-story"
    render(<AdminBarClient />)

    expect(await screen.findByRole("link", { name: "Edit Article" })).toHaveAttribute(
      "href",
      expect.stringContaining("/admin/collections/articles/42"),
    )
    const lookup = new URL(fetchMock.mock.calls[1]![0])
    expect(lookup.pathname).toBe("/api/articles")
    expect(lookup.searchParams.get("where[slug][equals]")).toBe("some-story")
    expect(lookup.searchParams.get("draft")).toBe("true")
  })

  it("looks up authors in the users collection and the home page by its slug", async () => {
    const fetchMock = stubPayload({ user: { id: "7", email: "ed@example.com" }, docs: [{ id: 3 }] })
    path.value = "/authors/jane-doe"
    render(<AdminBarClient />)
    await screen.findByRole("link", { name: "Edit Author" })
    expect(new URL(fetchMock.mock.calls[1]![0]).pathname).toBe("/api/users")

    cleanup()
    fetchMock.mockClear()
    path.value = "/"
    render(<AdminBarClient />)
    await screen.findByRole("link", { name: "Edit Page" })
    const lookup = new URL(fetchMock.mock.calls[1]![0])
    expect(lookup.pathname).toBe("/api/pages")
    expect(lookup.searchParams.get("where[slug][equals]")).toBe("home")
  })
})
