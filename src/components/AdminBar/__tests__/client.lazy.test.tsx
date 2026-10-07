import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../client", () => ({
  AdminBarClient: ({ preview }: { preview?: boolean }) => (
    <div data-testid="admin-bar">{preview ? "preview" : "live"}</div>
  ),
}))

import { LazyAdminBar } from "../client.lazy"

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
    const { container } = render(<LazyAdminBar />)
    await settle()
    await settle()
    expect(container).toBeEmptyDOMElement()
  })
})
