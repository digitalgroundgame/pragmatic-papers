import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useMediaReferences } from "../useMediaReferences"

const references = [
  { collection: "articles", field: "heroImage", docId: 7, docTitle: "Hero", docSlug: "hero" },
]

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const respondWith = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))

describe("useMediaReferences", () => {
  it("fetches the media's references with the admin session", async () => {
    respondWith(200, { references })

    const { result } = renderHook(() => useMediaReferences(101))

    expect(result.current).toEqual({ references: [], loading: true })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.references).toEqual(references)
    expect(fetchMock).toHaveBeenCalledWith("/api/media/101/references", {
      credentials: "include",
    })
  })

  it("reports no references when the request is refused", async () => {
    respondWith(403, { error: "Forbidden" })

    const { result } = renderHook(() => useMediaReferences(102))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.references).toEqual([])
  })

  it("reports no references when the request fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

    const { result } = renderHook(() => useMediaReferences(103))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.references).toEqual([])
  })

  it("waits without fetching until the document has an id", () => {
    const { result } = renderHook(() => useMediaReferences(undefined))

    expect(result.current).toEqual({ references: [], loading: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ignores a response that lands after unmounting", async () => {
    let resolve: (response: Response) => void = () => undefined
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const { result, unmount } = renderHook(() => useMediaReferences(104))
    unmount()
    resolve(new Response(JSON.stringify({ references }), { status: 200 }))
    await new Promise((r) => setTimeout(r, 0))

    expect(result.current).toEqual({ references: [], loading: true })
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
