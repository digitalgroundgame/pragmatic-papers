import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SHARED_FOR_MS, useMediaReferences } from "../useMediaReferences"

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

  it("shares one request between the notice and the References tab", async () => {
    respondWith(200, { references })

    const notice = renderHook(() => useMediaReferences(201))
    const tab = renderHook(() => useMediaReferences(201))

    await waitFor(() => expect(tab.result.current.loading).toBe(false))
    expect(notice.result.current.references).toEqual(references)
    expect(tab.result.current.references).toEqual(references)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("asks again once the shared result is stale", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    respondWith(200, { references })

    const first = renderHook(() => useMediaReferences(202))
    await waitFor(() => expect(first.result.current.loading).toBe(false))

    now.mockReturnValue(1_000_000 + SHARED_FOR_MS)
    respondWith(200, { references: [] })
    const later = renderHook(() => useMediaReferences(202))
    await waitFor(() => expect(later.result.current.loading).toBe(false))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(later.result.current.references).toEqual([])
    now.mockRestore()
  })

  it("tries again after a failed request instead of reusing it", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    const failed = renderHook(() => useMediaReferences(203))
    await waitFor(() => expect(failed.result.current.loading).toBe(false))

    respondWith(200, { references })
    const retry = renderHook(() => useMediaReferences(203))
    await waitFor(() => expect(retry.result.current.loading).toBe(false))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(retry.result.current.references).toEqual(references)
  })
})
