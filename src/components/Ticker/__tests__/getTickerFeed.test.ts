import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as ReactModule from "react"

import type { TickerPost } from "../items"
import type * as SourcesModule from "../sources"

const { integrations, ticker, cacheCalls, loadSource } = vi.hoisted(() => ({
  integrations: { current: {} as Record<string, unknown> },
  ticker: { current: {} as Record<string, unknown> },
  cacheCalls: [] as { keys: string[]; options: { revalidate: number; tags: string[] } }[],
  loadSource: vi.fn(),
}))

// The cache is a pass-through that records how each source asked to be cached.
vi.mock("next/cache", () => ({
  unstable_cache: (
    fn: (...args: unknown[]) => unknown,
    keys: string[],
    options: { revalidate: number; tags: string[] },
  ) => {
    cacheCalls.push({ keys, options })
    return fn
  },
}))
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  cache: <T>(fn: T) => fn,
}))
vi.mock("@/data/globals", () => ({
  getGlobal: async (slug: string) =>
    slug === "integrations" ? integrations.current : slug === "ticker" ? ticker.current : {},
}))
vi.mock("../sources", async (importOriginal) => ({
  ...(await importOriginal<typeof SourcesModule>()),
  loadSource,
}))

const { getTickerFeed } = await import("../getTickerFeed")
const { broadcastSource, postSources } = await import("../sources")

const post = (id: string, createdAt: string): TickerPost => ({
  id,
  source: "bluesky",
  text: id,
  links: [],
  url: `https://example.com/${id}`,
  createdAt,
})

beforeEach(() => {
  loadSource.mockReset()
  integrations.current = {}
  ticker.current = {}
})

describe("getTickerFeed", () => {
  it("caches each source for its own period under the ticker tag", () => {
    expect(cacheCalls.map((call) => call.keys)).toEqual([
      ["ticker", "broadcast"],
      ...postSources.map((source) => ["ticker", source.integration.id]),
    ])
    expect(cacheCalls.map((call) => call.options)).toEqual([
      { revalidate: broadcastSource.revalidate, tags: ["ticker"] },
      ...postSources.map((source) => ({ revalidate: source.revalidate, tags: ["ticker"] })),
    ])
  })

  it("passes the admin's settings to every source", async () => {
    integrations.current = {
      youtube: { channels: [{ channelId: "UC1" }, { channelId: "UC2" }] },
      bluesky: { handles: [{ handle: "admin.bsky.social" }, { handle: "other.bsky.social" }] },
      x: { usernames: [{ username: "AdminPick" }] },
    }
    loadSource.mockImplementation(async (_source, fallback) => fallback)
    await getTickerFeed()
    const settings = {
      youtubeChannelIds: ["UC1", "UC2"],
      blueskyHandles: ["admin.bsky.social", "other.bsky.social"],
      xUsernames: ["AdminPick"],
    }
    expect(loadSource).toHaveBeenCalledTimes(1 + postSources.length)
    expect(loadSource).toHaveBeenCalledWith(broadcastSource, null, settings)
    for (const source of postSources) {
      expect(loadSource).toHaveBeenCalledWith(source, [], settings)
    }
  })

  it("leaves the settings empty when the global has none, so connections fall back", async () => {
    loadSource.mockImplementation(async (_source, fallback) => fallback)
    await getTickerFeed()
    expect(loadSource).toHaveBeenCalledWith(broadcastSource, null, {
      youtubeChannelIds: undefined,
      blueskyHandles: undefined,
      xUsernames: undefined,
    })
  })

  it("returns the broadcast and every source's posts merged, newest first", async () => {
    const live = { status: "live", title: "On air", url: "https://youtu.be/1", startsAt: null }
    const older = post("older", "2026-10-08T10:00:00Z")
    const newer = post("newer", "2026-10-08T12:00:00Z")
    loadSource.mockImplementation(async (source) =>
      source === broadcastSource ? live : source === postSources[0] ? [older] : [newer],
    )
    expect(await getTickerFeed()).toEqual({ broadcast: live, posts: [newer, older] })
  })

  it("leaves out the posts an editor hid, and fills their places with the next newest", async () => {
    const hidden = {
      ...post("hidden", "2026-10-08T12:00:00Z"),
      url: "https://x.com/PragPapers/status/9",
    }
    const kept = post("kept", "2026-10-08T10:00:00Z")
    ticker.current = { hidden: [{ url: "https://twitter.com/PragPapers/status/9" }] }
    loadSource.mockImplementation(async (source) =>
      source === broadcastSource ? null : source === postSources[0] ? [hidden, kept] : [],
    )
    expect((await getTickerFeed()).posts).toEqual([kept])
  })
})
