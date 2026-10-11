import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { xAccounts } from "../index"

const account = xAccounts({
  id: "x-example",
  label: "Example account",
  defaultUsernames: ["Example"],
  usernamesEnv: "EXAMPLE_X_USERNAMES",
  tokenEnv: "EXAMPLE_X_TOKEN",
})

const username = "Example"

const reply = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

/** A fetch that answers the username lookup, then the posts. */
function x(posts: unknown): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async (input) =>
    String(input).includes("/users/by/username/")
      ? reply({ data: { id: "42", username: "Example" } })
      : reply(posts),
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("xAccounts", () => {
  it("needs a token, and names it without its value", () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "")
    expect(integrationStatus(account)).toMatchObject({
      service: "X",
      target: "x:@Example",
      configured: false,
      missing: ["EXAMPLE_X_TOKEN"],
    })
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    expect(JSON.stringify(integrationStatus(account))).not.toContain("secret-token")
  })

  it("reads the admin's usernames over the variable's, then the default", () => {
    vi.stubEnv("EXAMPLE_X_USERNAMES", "FromEnv, @Second")
    expect(account.usernames(["@FromAdmin"])).toEqual(["FromAdmin"])
    expect(account.usernames([])).toEqual(["FromEnv", "Second"])
    expect(account.describe()).toBe("x:@FromEnv, x:@Second")
    vi.stubEnv("EXAMPLE_X_USERNAMES", "")
    expect(account.usernames()).toEqual(["Example"])
  })

  it("looks the username up, then reads its posts without replies or reposts", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    const fetchImpl = x({
      data: [
        {
          id: "1001",
          text: "Volume 12 is out https://t.co/abc",
          created_at: "2026-10-07T12:00:00.000Z",
          entities: {
            urls: [{ url: "https://t.co/abc", expanded_url: "https://pragmaticpapers.com/vol-12" }],
          },
        },
      ],
    })
    const posts = await account.recentPosts({ username, limit: 3, fetchImpl })

    const [lookup, timeline] = fetchImpl.mock.calls
    expect(String(lookup![0])).toBe("https://api.x.com/2/users/by/username/Example")
    const url = new URL(String(timeline![0]))
    expect(url.pathname).toBe("/2/users/42/tweets")
    expect(url.searchParams.get("exclude")).toBe("replies,retweets")
    expect(url.searchParams.get("max_results")).toBe("5")
    expect(url.searchParams.get("tweet.fields")).toBe("created_at,entities")
    expect(timeline![1]?.headers).toEqual({ Authorization: "Bearer secret-token" })
    expect(posts).toEqual([
      {
        id: "1001",
        text: "Volume 12 is out https://t.co/abc",
        links: [{ text: "https://t.co/abc", url: "https://pragmaticpapers.com/vol-12" }],
        url: "https://x.com/Example/status/1001",
        createdAt: "2026-10-07T12:00:00.000Z",
      },
    ])
  })

  it("reads the username it's given, without its @", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    const fetchImpl = x({ meta: { result_count: 0 } })
    await account.recentPosts({ username: "@FromAdmin", fetchImpl })
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(
      "https://api.x.com/2/users/by/username/FromAdmin",
    )
  })

  it("reads an account with no posts as an empty list", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    expect(
      await account.recentPosts({ username, fetchImpl: x({ meta: { result_count: 0 } }) }),
    ).toEqual([])
  })

  it("throws X's own reason, never the token", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply(
        { title: "CreditsDepleted", detail: "Your enrolled account does not have any credits" },
        402,
      ),
    )
    const error = (await account
      .recentPosts({ username, fetchImpl })
      .catch((e: Error) => e)) as Error
    expect(error.message).toBe(
      "X users/by/username/Example failed (HTTP 402): Your enrolled account does not have any credits",
    )
    expect(error.message).not.toContain("secret-token")
  })

  it("throws on an unknown username, which X answers with a 200", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply({ errors: [{ detail: "Could not find user with username: [Example]." }] }),
    )
    await expect(account.recentPosts({ username, fetchImpl })).rejects.toThrow(
      "Could not find user with username: [Example].",
    )
  })
})
