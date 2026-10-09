import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { blueskyAccounts } from "../index"

const account = blueskyAccounts({
  id: "bluesky-example",
  label: "Example account",
  defaultHandles: ["example.bsky.social"],
  handlesEnv: "EXAMPLE_BLUESKY_HANDLES",
})

const handle = "example.bsky.social"

const reply = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const post = (
  rkey: string,
  text: string,
  author = handle,
  extra: { facets?: unknown[]; embed?: unknown } = {},
) => ({
  post: {
    uri: `at://did:plc:abc/app.bsky.feed.post/${rkey}`,
    author: { handle: author },
    record: { text, createdAt: "2026-10-07T12:00:00.000Z", facets: extra.facets },
    embed: extra.embed,
  },
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("blueskyAccounts", () => {
  it("is configured with no credentials, and can be pointed at other handles", () => {
    expect(integrationStatus(account)).toMatchObject({
      service: "Bluesky",
      target: "bluesky:@example.bsky.social",
      configured: true,
      unset: ["EXAMPLE_BLUESKY_HANDLES"],
    })
    vi.stubEnv("EXAMPLE_BLUESKY_HANDLES", "@one.bsky.social, two.bsky.social,,")
    expect(account.describe()).toBe("bluesky:@one.bsky.social, bluesky:@two.bsky.social")
  })

  it("reads the admin's handles over the variable's, each once", () => {
    vi.stubEnv("EXAMPLE_BLUESKY_HANDLES", "env.bsky.social")
    expect(
      account.handles(["@admin.bsky.social", "admin.bsky.social ", "other.bsky.social"]),
    ).toEqual(["admin.bsky.social", "other.bsky.social"])
    expect(account.handles([])).toEqual(["env.bsky.social"])
    vi.stubEnv("EXAMPLE_BLUESKY_HANDLES", "")
    expect(account.handles(null)).toEqual(["example.bsky.social"])
  })

  it("reads the account's own posts from the public AppView, linked on bsky.app", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply({
        feed: [
          post("3k1", "New article: the filibuster, explained"),
          {
            ...post("3k2", "Someone else's post", "friend.bsky.social"),
            reason: { $type: "app.bsky.feed.defs#reasonRepost" },
          },
          post("3k3", "   "),
        ],
      }),
    )
    const posts = await account.recentPosts({ handle, limit: 3, fetchImpl })

    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.origin + url.pathname).toBe(
      "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed",
    )
    expect(url.searchParams.get("actor")).toBe("example.bsky.social")
    expect(url.searchParams.get("filter")).toBe("posts_no_replies")
    expect(posts).toEqual([
      {
        uri: "at://did:plc:abc/app.bsky.feed.post/3k1",
        text: "New article: the filibuster, explained",
        links: [],
        url: "https://bsky.app/profile/example.bsky.social/post/3k1",
        createdAt: "2026-10-07T12:00:00.000Z",
      },
    ])
  })

  it("reads the handle it's given, without its @", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => reply({ feed: [] }))
    await account.recentPosts({ handle: "@admin.bsky.social", fetchImpl })
    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.searchParams.get("actor")).toBe("admin.bsky.social")
  })

  it("finds links by their byte offsets, as shortened in the text, then the link card's", async () => {
    // The emoji is four bytes in UTF-8 and two characters in JavaScript.
    const text = "🎉 Out now: pragmaticpapers.com/vol..."
    const start = new TextEncoder().encode("🎉 Out now: ").length
    const end = new TextEncoder().encode(text).length
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply({
        feed: [
          post("3k1", text, handle, {
            facets: [
              {
                index: { byteStart: start, byteEnd: end },
                features: [
                  {
                    $type: "app.bsky.richtext.facet#link",
                    uri: "https://pragmaticpapers.com/vol-12",
                  },
                ],
              },
              {
                index: { byteStart: 0, byteEnd: 4 },
                features: [{ $type: "app.bsky.richtext.facet#tag", tag: "vote" }],
              },
            ],
            embed: { external: { uri: "https://example.com/card" } },
          }),
          post("3k2", "Same link, carded", handle, {
            facets: [],
            embed: { external: { uri: "https://example.com/card" } },
          }),
        ],
      }),
    )
    const [first, second] = await account.recentPosts({ handle, fetchImpl })
    expect(first!.links).toEqual([
      { text: "pragmaticpapers.com/vol...", url: "https://pragmaticpapers.com/vol-12" },
      { text: "", url: "https://example.com/card" },
    ])
    expect(second!.links).toEqual([{ text: "", url: "https://example.com/card" }])
  })

  it("keeps at most `limit` posts", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply({ feed: [post("a", "one"), post("b", "two"), post("c", "three")] }),
    )
    expect(await account.recentPosts({ handle, limit: 2, fetchImpl })).toHaveLength(2)
  })

  it("throws Bluesky's message when it refuses", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply({ error: "InvalidRequest", message: "Profile not found" }, 400),
    )
    await expect(account.recentPosts({ handle, fetchImpl })).rejects.toThrow(
      "Bluesky feed for @example.bsky.social failed (HTTP 400): Profile not found",
    )
  })
})
