import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../client", () => ({
  AdminBarClient: ({ preview }: { preview?: boolean }) => (
    <div data-testid="admin-bar">{preview ? "preview" : "live"}</div>
  ),
}))

import { LazyAdminBar } from "../client.lazy"
import { ADMIN_BAR_ATTRIBUTE, ADMIN_BAR_HINT_KEY } from "../hint"

function stubMe(response: { ok?: boolean; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return { ok: response.ok ?? true, json: async () => response.body } as Response
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

// Lets the lookup, and the bar's chunk, settle.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.removeAttribute(ADMIN_BAR_ATTRIBUTE)
})

describe("LazyAdminBar", () => {
  it("loads the bar for someone logged in, in draft mode as asked", async () => {
    const fetchMock = stubMe({ body: { user: { id: "7" } } })
    render(<LazyAdminBar preview />)
    expect(await screen.findByTestId("admin-bar")).toHaveTextContent("preview")
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/users\/me$/),
      expect.objectContaining({ credentials: "include" }),
    )
  })

  it.each([
    ["isn't logged in", { body: { user: null } }],
    ["gets an error from Payload", { ok: false, body: { user: { id: "7" } } }],
    ["can't reach Payload", new Error("offline")],
  ])("renders nothing for a reader who %s", async (_, response) => {
    stubMe(response)
    render(<LazyAdminBar />)
    await settle()
    await settle()
    expect(screen.queryByTestId("admin-bar")).not.toBeInTheDocument()
    // Its slot stays hidden, so readers get no gap.
    expect(document.documentElement).not.toHaveAttribute(ADMIN_BAR_ATTRIBUTE)
    expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBeNull()
  })

  it("remembers someone logged in, and shows the bar's slot", async () => {
    stubMe({ body: { user: { id: "7" } } })
    render(<LazyAdminBar />)
    await screen.findByTestId("admin-bar")
    expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBe("1")
    expect(document.documentElement).toHaveAttribute(ADMIN_BAR_ATTRIBUTE)
  })

  it("loads the bar before the lookup answers when the last page saw someone logged in", async () => {
    localStorage.setItem(ADMIN_BAR_HINT_KEY, "1")
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    )
    render(<LazyAdminBar />)
    expect(await screen.findByTestId("admin-bar")).toBeInTheDocument()
  })

  it("forgets the hint, and collapses the slot, once Payload says nobody is logged in", async () => {
    localStorage.setItem(ADMIN_BAR_HINT_KEY, "1")
    document.documentElement.setAttribute(ADMIN_BAR_ATTRIBUTE, "")
    stubMe({ body: { user: null } })
    render(<LazyAdminBar />)
    await settle()
    await settle()
    expect(screen.queryByTestId("admin-bar")).not.toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBeNull()
    expect(document.documentElement).not.toHaveAttribute(ADMIN_BAR_ATTRIBUTE)
  })

  it("keeps the hint when Payload can't be reached", async () => {
    localStorage.setItem(ADMIN_BAR_HINT_KEY, "1")
    stubMe(new Error("offline"))
    render(<LazyAdminBar />)
    await settle()
    expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBe("1")
  })
})
