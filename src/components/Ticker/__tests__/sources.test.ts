import { afterEach, describe, expect, it, vi } from "vitest"

import { blueskyPosts, type Integration, xPosts, youtubeLive } from "@/integrations"

import { broadcastSource, loadSource, postSources, type TickerSource } from "../sources"

const integration = (required: string[]): Integration => ({
  id: "test-source",
  label: "Test source",
  service: "Test",
  describe: () => "test:source",
  required,
})

const source = (
  required: string[],
  load: TickerSource<string[]>["load"],
): TickerSource<string[]> => ({
  integration: integration(required),
  revalidate: 60,
  load,
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("loadSource", () => {
  it("returns what the source loads", async () => {
    expect(
      await loadSource(
        source([], async () => ["a"]),
        [],
      ),
    ).toEqual(["a"])
  })

  it("passes the admin's settings to the source", async () => {
    const load = vi.fn(async () => ["a"])
    await loadSource(source([], load), [], { blueskyHandle: "admin.bsky.social" })
    expect(load).toHaveBeenCalledWith(expect.any(AbortSignal), {
      blueskyHandle: "admin.bsky.social",
    })
  })

  it("skips an unconfigured source without calling it, naming what to set", async () => {
    vi.stubEnv("TEST_SOURCE_TOKEN", "")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const load = vi.fn(async () => ["a"])
    expect(await loadSource(source(["TEST_SOURCE_TOKEN"], load), [])).toEqual([])
    expect(load).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("set TEST_SOURCE_TOKEN"))
  })

  it("falls back when the source fails, so the page still renders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const failing = source([], async () => {
      throw new Error("HTTP 503")
    })
    expect(await loadSource(failing, ["fallback"])).toEqual(["fallback"])
    expect(warn).toHaveBeenCalledWith("[ticker] Test source failed:", "HTTP 503")
  })

  it("gives the source a signal that aborts after a few seconds", async () => {
    let signal: AbortSignal | undefined
    await loadSource(
      source([], async (s) => {
        signal = s
        return []
      }),
      [],
    )
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal!.aborted).toBe(false)
  })
})

describe("broadcastSource", () => {
  const signal = new AbortController().signal

  it("reads the admin's channels and maps the broadcast onto the ticker's shape", async () => {
    const current = vi.spyOn(youtubeLive, "currentBroadcast").mockResolvedValue({
      videoId: "abc",
      title: "Pragmatic Papers Live",
      url: "https://www.youtube.com/watch?v=abc",
      status: "upcoming",
      scheduledStart: "2026-10-08T23:00:00Z",
    })
    expect(await broadcastSource.load(signal, { youtubeChannelIds: ["UC1", "UC2"] })).toEqual({
      status: "upcoming",
      title: "Pragmatic Papers Live",
      url: "https://www.youtube.com/watch?v=abc",
      startsAt: "2026-10-08T23:00:00Z",
    })
    expect(current).toHaveBeenCalledWith({ channelIds: ["UC1", "UC2"], signal })
  })

  it("is null when nothing is on air", async () => {
    vi.spyOn(youtubeLive, "currentBroadcast").mockResolvedValue(null)
    expect(await broadcastSource.load(signal, {})).toBeNull()
  })
})

describe("postSources", () => {
  const signal = new AbortController().signal
  const [bluesky, x] = postSources

  it("checks X far less often than Bluesky, since X reads are paid", () => {
    expect(bluesky!.integration).toBe(blueskyPosts)
    expect(x!.integration).toBe(xPosts)
    expect(x!.revalidate).toBeGreaterThan(bluesky!.revalidate)
  })

  it("maps Bluesky posts, keyed by their URI, from the admin's handle", async () => {
    const recent = vi.spyOn(blueskyPosts, "recentPosts").mockResolvedValue([
      {
        uri: "at://did:plc:1/app.bsky.feed.post/1",
        text: "Hello",
        url: "https://bsky.app/profile/pp/post/1",
        createdAt: "2026-10-08T12:00:00Z",
      },
    ] as never)
    expect(await bluesky!.load(signal, { blueskyHandle: "admin.bsky.social" })).toEqual([
      {
        id: "bluesky:at://did:plc:1/app.bsky.feed.post/1",
        source: "bluesky",
        text: "Hello",
        url: "https://bsky.app/profile/pp/post/1",
        createdAt: "2026-10-08T12:00:00Z",
      },
    ])
    expect(recent).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "admin.bsky.social", signal }),
    )
  })

  it("maps X posts, keyed by their ID, from the admin's username", async () => {
    const recent = vi.spyOn(xPosts, "recentPosts").mockResolvedValue([
      {
        id: "42",
        text: "Hi",
        url: "https://x.com/PragPapers/status/42",
        createdAt: "2026-10-08T13:00:00Z",
      },
    ] as never)
    expect(await x!.load(signal, { xUsername: "AdminPick" })).toEqual([
      {
        id: "x:42",
        source: "x",
        text: "Hi",
        url: "https://x.com/PragPapers/status/42",
        createdAt: "2026-10-08T13:00:00Z",
      },
    ])
    expect(recent).toHaveBeenCalledWith(expect.objectContaining({ username: "AdminPick", signal }))
  })
})
