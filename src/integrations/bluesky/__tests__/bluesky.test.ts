import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { blueskyAccount } from "../index"

const account = blueskyAccount({
  id: "bluesky-example",
  label: "Example account",
  defaultHandle: "example.bsky.social",
  handleEnv: "EXAMPLE_BLUESKY_HANDLE",
})

const reply = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const post = (rkey: string, text: string, handle = "example.bsky.social") => ({
  post: {
    uri: `at://did:plc:abc/app.bsky.feed.post/${rkey}`,
    author: { handle },
    record: { text, createdAt: "2026-10-07T12:00:00.000Z" },
  },
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("blueskyAccount", () => {
  it("is configured with no credentials, and can be pointed at another handle", () => {
    expect(integrationStatus(account)).toMatchObject({
      service: "Bluesky",
      target: "bluesky:@example.bsky.social",
      configured: true,
      unset: ["EXAMPLE_BLUESKY_HANDLE"],
    })
    vi.stubEnv("EXAMPLE_BLUESKY_HANDLE", "@other.bsky.social")
    expect(account.describe()).toBe("bluesky:@other.bsky.social")
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
    const posts = await account.recentPosts({ limit: 3, fetchImpl })

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
        url: "https://bsky.app/profile/example.bsky.social/post/3k1",
        createdAt: "2026-10-07T12:00:00.000Z",
      },
    ])
  })

  it("reads the handle set in the admin over the variable", async () => {
    vi.stubEnv("EXAMPLE_BLUESKY_HANDLE", "env.bsky.social")
    const fetchImpl = vi.fn<typeof fetch>(async () => reply({ feed: [] }))
    await account.recentPosts({ handle: "@admin.bsky.social", fetchImpl })
    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.searchParams.get("actor")).toBe("admin.bsky.social")
  })

  it("keeps at most `limit` posts", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply({ feed: [post("a", "one"), post("b", "two"), post("c", "three")] }),
    )
    expect(await account.recentPosts({ limit: 2, fetchImpl })).toHaveLength(2)
  })

  it("throws Bluesky's message when it refuses", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply({ error: "InvalidRequest", message: "Profile not found" }, 400),
    )
    await expect(account.recentPosts({ fetchImpl })).rejects.toThrow(
      "Bluesky feed for @example.bsky.social failed (HTTP 400): Profile not found",
    )
  })
})
