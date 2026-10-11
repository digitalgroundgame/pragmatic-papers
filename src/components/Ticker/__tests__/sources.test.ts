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
    await loadSource(source([], load), [], { blueskyHandles: ["admin.bsky.social"] })
    expect(load).toHaveBeenCalledWith(expect.any(AbortSignal), {
      blueskyHandles: ["admin.bsky.social"],
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

  it("maps every admin handle's Bluesky posts, keyed by their URI, with their links", async () => {
    const recent = vi.spyOn(blueskyPosts, "recentPosts").mockImplementation(async ({ handle }) => [
      {
        uri: `at://${handle}/app.bsky.feed.post/1`,
        text: `Hello from ${handle}`,
        links: [{ text: "pp.com/a", url: "https://pp.com/a" }],
        url: `https://bsky.app/profile/${handle}/post/1`,
        createdAt: "2026-10-08T12:00:00Z",
      },
    ])
    const posts = await bluesky!.load(signal, {
      blueskyHandles: ["one.bsky.social", "two.bsky.social"],
    })
    expect(posts).toEqual([
      {
        id: "bluesky:at://one.bsky.social/app.bsky.feed.post/1",
        source: "bluesky",
        text: "Hello from one.bsky.social",
        links: [{ text: "pp.com/a", url: "https://pp.com/a" }],
        url: "https://bsky.app/profile/one.bsky.social/post/1",
        createdAt: "2026-10-08T12:00:00Z",
      },
      expect.objectContaining({ id: "bluesky:at://two.bsky.social/app.bsky.feed.post/1" }),
    ])
    expect(recent).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "one.bsky.social", signal }),
    )
    expect(recent).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "two.bsky.social", signal }),
    )
  })

  it("maps every admin username's X posts, keyed by their ID", async () => {
    const recent = vi.spyOn(xPosts, "recentPosts").mockResolvedValue([
      {
        id: "42",
        text: "Hi",
        links: [],
        url: "https://x.com/PragPapers/status/42",
        createdAt: "2026-10-08T13:00:00Z",
      },
    ])
    expect(await x!.load(signal, { xUsernames: ["AdminPick"] })).toEqual([
      {
        id: "x:42",
        source: "x",
        text: "Hi",
        links: [],
        url: "https://x.com/PragPapers/status/42",
        createdAt: "2026-10-08T13:00:00Z",
      },
    ])
    expect(recent).toHaveBeenCalledWith(expect.objectContaining({ username: "AdminPick", signal }))
  })

  it("leaves out an account that fails, and keeps the rest", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(blueskyPosts, "recentPosts").mockImplementation(async ({ handle }) => {
      if (handle === "gone.bsky.social") throw new Error("Profile not found")
      return [
        {
          uri: "at://ok/1",
          text: "Still here",
          links: [],
          url: "https://bsky.app/1",
          createdAt: "2026-10-08T12:00:00Z",
        },
      ]
    })
    const posts = await bluesky!.load(signal, {
      blueskyHandles: ["gone.bsky.social", "ok.bsky.social"],
    })
    expect(posts.map((post) => post.text)).toEqual(["Still here"])
    expect(warn).toHaveBeenCalledWith(
      "[ticker] Bluesky @gone.bsky.social failed:",
      "Profile not found",
    )
  })

  it("fails when every account does, so the source falls back", async () => {
    vi.spyOn(blueskyPosts, "recentPosts").mockRejectedValue(new Error("HTTP 503"))
    await expect(bluesky!.load(signal, { blueskyHandles: ["a.bsky.social"] })).rejects.toThrow(
      "HTTP 503",
    )
  })
})
