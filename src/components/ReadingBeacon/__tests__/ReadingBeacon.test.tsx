import { act, render } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { localDay } from "@/plugins/readingHistory/days"

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
const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))

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
  it("sends nothing for a reader who isn't signed in", () => {
    render(<ReadingBeacon />)
    render(<ReadingBeacon articleId={10} />)
    expect(intersect).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reports a signed-in visit once a day", () => {
    signIn()
    render(<ReadingBeacon />)
    render(<ReadingBeacon />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reading",
      expect.objectContaining({ method: "POST", credentials: "same-origin", keepalive: true }),
    )
    expect(bodies()).toEqual([{ day: localDay() }])
  })

  it("reports an article read once the reader reaches its end", () => {
    signIn()
    const { container } = render(<ReadingBeacon articleId={10} />)
    expect(container.querySelector("span[aria-hidden]")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

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
    expect(fetchMock).not.toHaveBeenCalled()

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
