// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildSnapshot } from "../helpers/buildSnapshot"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

const NOW = "2026-06-01T00:00:00.000Z"

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  fetchMock.mockReset()
  vi.useRealTimers()
})

describe("buildSnapshot", () => {
  it("snapshots a rich embed with sanitized html", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        type: "rich",
        version: "1.0",
        html: '<blockquote class="twitter-tweet"><p>Hi</p></blockquote><script></script>',
        width: 550,
        height: null,
        provider_name: "Twitter",
        provider_url: "https://twitter.com",
        author_name: "Jack",
        author_url: "https://twitter.com/jack",
        url: "https://twitter.com/jack/status/20",
      }),
    )

    const snapshot = await buildSnapshot({
      platform: "twitter",
      url: "https://x.com/jack/status/20",
      hideMedia: true,
      hideThread: false,
    })

    expect(snapshot).toEqual({
      status: "ok",
      providerName: "Twitter",
      providerURL: "https://twitter.com",
      authorName: "Jack",
      authorURL: "https://twitter.com/jack",
      title: undefined,
      html: '<blockquote class="twitter-tweet"><p>Hi</p></blockquote>',
      thumbnailURL: undefined,
      fetchedAt: NOW,
    })
    const [requested] = fetchMock.mock.calls[0] as [URL]
    expect(requested.searchParams.get("hide_media")).toBe("true")
    expect(requested.searchParams.get("hide_thread")).toBe("false")
  })

  it("records a video's thumbnail and skips html for non-rich responses", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        type: "video",
        version: "1.0",
        html: "<iframe></iframe>",
        title: "A video",
        thumbnail_url: "https://i.ytimg.com/vi/abc/hq.jpg",
        thumbnail_width: 480,
        thumbnail_height: 360,
      }),
    )

    const snapshot = await buildSnapshot({ platform: "youtube", url: "https://youtu.be/abc" })

    expect(snapshot).toMatchObject({
      status: "ok",
      title: "A video",
      html: undefined,
      thumbnailURL: "https://i.ytimg.com/vi/abc/hq.jpg",
    })
    const [requested] = fetchMock.mock.calls[0] as [URL]
    expect(requested.searchParams.has("hide_media")).toBe(false)
  })

  it("keeps the previous snapshot and records the error code when the fetch fails", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 403, statusText: "Forbidden" }))
    const previous = { status: "ok" as const, title: "Old", html: "<p>old</p>" }

    const snapshot = await buildSnapshot({
      platform: "reddit",
      url: "https://www.reddit.com/r/a/comments/1",
      snapshot: previous,
    })

    expect(snapshot).toEqual({ ...previous, status: "forbidden", fetchedAt: NOW })
  })

  it("records a generic error for an invalid URL", async () => {
    const snapshot = await buildSnapshot({ platform: "bluesky", url: "https://example.com" })

    expect(snapshot).toEqual({ status: "error", fetchedAt: NOW })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("marks a platform without an adapter as not found", async () => {
    expect(await buildSnapshot({ platform: "mastodon" as never, url: "https://x" })).toEqual({
      status: "not_found",
      title: "No adapter found",
      fetchedAt: NOW,
    })
    expect(
      await buildSnapshot({
        platform: "mastodon" as never,
        url: "https://x",
        snapshot: { title: "Kept" },
      }),
    ).toMatchObject({ title: "Kept" })
  })
})
