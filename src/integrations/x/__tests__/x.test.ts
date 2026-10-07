import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { xAccount } from "../index"

const account = xAccount({
  id: "x-example",
  label: "Example account",
  defaultUsername: "Example",
  usernameEnv: "EXAMPLE_X_USERNAME",
  tokenEnv: "EXAMPLE_X_TOKEN",
})

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

describe("xAccount", () => {
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

  it("looks the username up, then reads its posts without replies or reposts", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    const fetchImpl = x({
      data: [{ id: "1001", text: "Volume 12 is out", created_at: "2026-10-07T12:00:00.000Z" }],
    })
    const posts = await account.recentPosts({ limit: 3, fetchImpl })

    const [lookup, timeline] = fetchImpl.mock.calls
    expect(String(lookup![0])).toBe("https://api.x.com/2/users/by/username/Example")
    const url = new URL(String(timeline![0]))
    expect(url.pathname).toBe("/2/users/42/tweets")
    expect(url.searchParams.get("exclude")).toBe("replies,retweets")
    expect(url.searchParams.get("max_results")).toBe("5")
    expect(timeline![1]?.headers).toEqual({ Authorization: "Bearer secret-token" })
    expect(posts).toEqual([
      {
        id: "1001",
        text: "Volume 12 is out",
        url: "https://x.com/Example/status/1001",
        createdAt: "2026-10-07T12:00:00.000Z",
      },
    ])
  })

  it("reads an account with no posts as an empty list", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    expect(await account.recentPosts({ fetchImpl: x({ meta: { result_count: 0 } }) })).toEqual([])
  })

  it("throws X's own reason, never the token", async () => {
    vi.stubEnv("EXAMPLE_X_TOKEN", "secret-token")
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply(
        { title: "CreditsDepleted", detail: "Your enrolled account does not have any credits" },
        402,
      ),
    )
    const error = (await account.recentPosts({ fetchImpl }).catch((e: Error) => e)) as Error
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
    await expect(account.recentPosts({ fetchImpl })).rejects.toThrow(
      "Could not find user with username: [Example].",
    )
  })
})
