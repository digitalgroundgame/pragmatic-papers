import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LinkedAccounts } from "../components/LinkedAccounts"

let userId: number | null = 1
let docId: number | null = 1
vi.mock("@payloadcms/ui", () => ({
  useAuth: () => ({ user: userId === null ? null : { id: userId } }),
  useDocumentInfo: () => ({ id: docId }),
  useConfig: () => ({ config: { routes: { api: "/api" } } }),
}))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))

const fetchMock = vi.fn<typeof fetch>()
const assign = vi.fn()

const list = (destiny: boolean) =>
  Response.json({
    providers: [
      { id: "discord", label: "Discord", linked: true },
      { id: "destiny", label: "Destiny.gg", linked: destiny },
    ],
  })

beforeEach(() => {
  userId = 1
  docId = 1
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("location", { ...window.location, assign })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe("LinkedAccounts", () => {
  it("shows the signed-in user's links on their own account", async () => {
    fetchMock.mockResolvedValue(list(false))
    render(<LinkedAccounts />)

    expect(await screen.findByRole("button", { name: "Connect Destiny.gg" })).toBeEnabled()
    expect(fetchMock).toHaveBeenCalledWith("/api/auth-links", { credentials: "include" })
  })

  it("renders nothing on someone else's record", async () => {
    docId = 2
    const { container } = render(<LinkedAccounts />)
    await act(() => Promise.resolve())
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renders nothing while single sign-on is off", async () => {
    fetchMock.mockResolvedValue(Response.json({ message: "Not Found" }, { status: 404 }))
    const { container } = render(<LinkedAccounts />)
    await act(() => Promise.resolve())
    expect(container).toBeEmptyDOMElement()
  })

  it("sends Connect to the provider", async () => {
    fetchMock
      .mockResolvedValueOnce(list(false))
      .mockResolvedValueOnce(Response.json({ url: "https://www.destiny.gg/oauth/authorize?x=1" }))
    render(<LinkedAccounts />)

    const button = await screen.findByRole("button", { name: "Connect Destiny.gg" })
    await act(async () => {
      fireEvent.click(button)
    })

    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth-links/destiny", {
      method: "POST",
      credentials: "include",
    })
    expect(assign).toHaveBeenCalledWith("https://www.destiny.gg/oauth/authorize?x=1")
  })

  it("disconnects, then shows the list again", async () => {
    fetchMock
      .mockResolvedValueOnce(list(true))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(list(false))
    render(<LinkedAccounts />)

    const button = await screen.findByRole("button", { name: "Disconnect Destiny.gg" })
    await act(async () => {
      fireEvent.click(button)
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/auth-links/destiny", {
      method: "DELETE",
      credentials: "include",
    })
    expect(await screen.findByRole("button", { name: "Connect Destiny.gg" })).toBeEnabled()
  })

  it("says so when a request fails", async () => {
    fetchMock
      .mockResolvedValueOnce(list(false))
      .mockResolvedValueOnce(Response.json({ message: "nope" }, { status: 500 }))
    render(<LinkedAccounts />)

    const button = await screen.findByRole("button", { name: "Connect Destiny.gg" })
    await act(async () => {
      fireEvent.click(button)
    })

    expect(screen.getByRole("alert")).toHaveTextContent("Linking didn't complete")
    expect(assign).not.toHaveBeenCalled()
  })
})
