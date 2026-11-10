import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ArticleViewBeacon } from ".."

const fetchMock = vi.fn<typeof fetch>()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

const stubBeacon = (accepted: boolean) => {
  const sendBeacon = vi.fn(() => accepted)
  Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true })
  return sendBeacon
}

describe("ArticleViewBeacon", () => {
  it("sends one beacon for the article, and renders nothing", () => {
    const sendBeacon = stubBeacon(true)
    vi.stubGlobal("fetch", fetchMock)

    const { container, rerender } = render(<ArticleViewBeacon articleId={7} />)
    rerender(<ArticleViewBeacon articleId={7} />)

    expect(container).toBeEmptyDOMElement()
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith("/api/articles/7/view")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("counts the next article when the page moves on to it", () => {
    const sendBeacon = stubBeacon(true)

    const { rerender } = render(<ArticleViewBeacon articleId={7} />)
    rerender(<ArticleViewBeacon articleId={8} />)

    expect(sendBeacon).toHaveBeenLastCalledWith("/api/articles/8/view")
    expect(sendBeacon).toHaveBeenCalledTimes(2)
  })

  it("posts with fetch when the browser refuses the beacon", () => {
    stubBeacon(false)
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(new Response(null, { status: 204 })))

    render(<ArticleViewBeacon articleId={7} apiPath="/cms/api" />)

    expect(fetchMock).toHaveBeenCalledWith("/cms/api/articles/7/view", {
      method: "POST",
      keepalive: true,
      credentials: "omit",
    })
  })

  it("ignores a failed request", async () => {
    stubBeacon(false)
    vi.stubGlobal("fetch", fetchMock.mockRejectedValue(new TypeError("offline")))

    render(<ArticleViewBeacon articleId={7} />)

    await expect(fetchMock.mock.results[0]!.value).rejects.toThrow("offline")
  })
})
