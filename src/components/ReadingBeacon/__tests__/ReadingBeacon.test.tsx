import { act, render } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { localDay } from "@/plugins/achievements/reading/days"

import { READ_AFTER_MS, ReadingBeacon } from ".."

const fetchMock = vi.fn<typeof fetch>()
let intersect: (() => void) | null = null

class FakeObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    intersect = () =>
      this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
  }
  disconnect() {
    intersect = null
  }
}

const signIn = () => {
  document.cookie = "pp-signed-in=1; path=/"
}
const cookieSet = () => document.cookie.includes("pp-signed-in=1")
const VIEW = /\/articles\/\d+\/view$/
/** The view counts sent, and everything else (the signed-in reader's reports). */
const views = () => fetchMock.mock.calls.filter(([url]) => VIEW.test(String(url)))
const reports = () => fetchMock.mock.calls.filter(([url]) => !VIEW.test(String(url)))
const bodies = () => reports().map(([, init]) => JSON.parse(String(init?.body)))

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("IntersectionObserver", FakeObserver)
  localStorage.clear()
  document.cookie = "pp-signed-in=; path=/; max-age=0"
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ReadingBeacon", () => {
  it("only counts the view for a reader who isn't signed in", () => {
    render(<ReadingBeacon />)
    render(<ReadingBeacon articleId={10} />)
    expect(intersect).toBeNull()
    expect(reports()).toEqual([])
    expect(views().map(([url]) => url)).toEqual(["/api/articles/10/view"])
  })

  it("counts each article's view once, and none off an article", () => {
    const { rerender } = render(<ReadingBeacon articleId={10} />)
    rerender(<ReadingBeacon articleId={10} />)
    rerender(<ReadingBeacon articleId={11} />)
    render(<ReadingBeacon />)
    expect(views().map(([url]) => url)).toEqual(["/api/articles/10/view", "/api/articles/11/view"])
  })

  it("counts the view without the reader's cookies, signed in or not", () => {
    signIn()
    const beacon = vi.fn(() => true)
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
    render(<ReadingBeacon articleId={10} apiPath="/cms/api" />)
    expect(fetchMock).toHaveBeenCalledWith("/cms/api/articles/10/view", {
      method: "POST",
      keepalive: true,
      credentials: "omit",
    })
    // sendBeacon always sends cookies, so the view never goes through it.
    expect(beacon).not.toHaveBeenCalled()
  })

  it("ignores a view count that fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"))
    render(<ReadingBeacon articleId={10} />)
    await expect(fetchMock.mock.results[0]!.value).rejects.toThrow("offline")
  })

  it("reports a signed-in visit once a day", async () => {
    signIn()
    render(<ReadingBeacon />)
    await vi.waitFor(() => expect(localStorage.length).toBe(1))
    render(<ReadingBeacon />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reading",
      expect.objectContaining({ method: "POST", credentials: "same-origin", keepalive: true }),
    )
    expect(bodies()).toEqual([{ day: localDay() }])
  })

  it("tries the day's visit again on the next page when it failed", async () => {
    signIn()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    render(<ReadingBeacon />)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    render(<ReadingBeacon />)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("doesn't ask again that day when the server turns it away", async () => {
    signIn()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    render(<ReadingBeacon />)
    await vi.waitFor(() => expect(localStorage.length).toBe(1))
    render(<ReadingBeacon />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("reports an article read once the reader reaches its end", () => {
    signIn()
    const { container } = render(<ReadingBeacon articleId={10} />)
    expect(container.querySelector("span[aria-hidden]")).toBeInTheDocument()
    expect(reports()).toEqual([])

    act(() => intersect!())
    expect(bodies()).toEqual([{ day: localDay(), article: 10 }])
    // Once: it stops watching.
    expect(intersect).toBeNull()
  })

  it("reports it read after two minutes in view, not counting time hidden", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    signIn()
    render(<ReadingBeacon articleId={10} />)

    act(() => vi.advanceTimersByTime(READ_AFTER_MS / 2))
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
    act(() => void document.dispatchEvent(new Event("visibilitychange")))
    act(() => vi.advanceTimersByTime(READ_AFTER_MS))
    expect(reports()).toEqual([])

    hidden.mockReturnValue("visible")
    act(() => void document.dispatchEvent(new Event("visibilitychange")))
    act(() => vi.advanceTimersByTime(READ_AFTER_MS / 2 + 5000))
    expect(bodies()).toEqual([{ day: localDay(), article: 10 }])
  })

  it("forgets the sign-in when the server says the session is over", async () => {
    signIn()
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    render(<ReadingBeacon />)
    await vi.waitFor(() => expect(cookieSet()).toBe(false))
  })
})
