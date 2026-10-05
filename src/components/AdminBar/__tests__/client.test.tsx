import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { path, router } = vi.hoisted(() => ({
  path: { value: "/" },
  router: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  usePathname: () => path.value,
  useRouter: () => router,
}))

import { AdminBarClient } from "../client"

const json = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response

const editor = { id: "7", email: "ed@example.com" }

function stubPayload({
  user,
  docs = [],
  lookupOk = true,
}: {
  user: unknown
  docs?: unknown[] | ((url: string) => unknown[])
  lookupOk?: boolean
}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/api/users/me")) return json({ user })
    if (url.includes("/next/exit-preview")) return json({})
    return json({ docs: typeof docs === "function" ? docs(url) : docs }, lookupOk)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  path.value = "/"
  vi.clearAllMocks()
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

  it("leaves out the Edit link when the page's document can't be found", async () => {
    const fetchMock = stubPayload({ user: editor, lookupOk: false })
    path.value = "/topics/gone"
    render(<AdminBarClient />)

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText("ed@example.com")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /^Edit/ })).not.toBeInTheDocument()
  })

  it("never points the Edit link at the previous page after a navigation", async () => {
    stubPayload({
      user: editor,
      docs: (url) => (url.includes("first") ? [{ id: 1 }] : [{ id: 2 }]),
    })
    path.value = "/articles/first"
    const { rerender } = render(<AdminBarClient />)
    expect(await screen.findByRole("link", { name: "Edit Article" })).toHaveAttribute(
      "href",
      expect.stringContaining("/collections/articles/1"),
    )

    path.value = "/articles/second"
    rerender(<AdminBarClient />)
    // The first article's ID is never shown for the second article, even before its lookup lands.
    expect(screen.queryByRole("link", { name: "Edit Article" })).not.toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Edit Article" })).toHaveAttribute(
      "href",
      expect.stringContaining("/collections/articles/2"),
    )
  })

  it("exits preview through the exit route, then reloads from the home page", async () => {
    const fetchMock = stubPayload({ user: editor })
    render(<AdminBarClient preview />)

    fireEvent.click(await screen.findByText("Exit preview mode"))

    expect(fetchMock).toHaveBeenCalledWith("/next/exit-preview")
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalled())
    expect(router.push).toHaveBeenCalledWith("/")
  })
})
