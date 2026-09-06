import { describe, expect, it, vi } from "vitest"

import { latestTaggedRelease } from "../sources/releases"

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

describe("latestTaggedRelease", () => {
  it("takes the newest release carrying the prefix and reads the version out of its tag", async () => {
    const fetchImpl = vi.fn(async () =>
      ok([{ tag_name: "data-v05d95d9fcf1b" }, { tag_name: "data-vaaaaaaaaaaaa" }]),
    )
    await expect(
      latestTaggedRelease({ repo: "o/r", tagPrefix: "data-v", fetchImpl }),
    ).resolves.toEqual({ tag: "data-v05d95d9fcf1b", version: "05d95d9fcf1b" })
  })

  it("ignores releases that are not data packages, and drafts", async () => {
    const fetchImpl = vi.fn(async () =>
      ok([
        { tag_name: "v2.1.0" },
        { tag_name: "data-vdraft", draft: true },
        { tag_name: "data-vreal" },
      ]),
    )
    await expect(
      latestTaggedRelease({ repo: "o/r", tagPrefix: "data-v", fetchImpl }),
    ).resolves.toMatchObject({ version: "real" })
  })

  it("returns null when the repo has published no data release yet", async () => {
    const fetchImpl = vi.fn(async () => ok([{ tag_name: "v1.0.0" }]))
    await expect(
      latestTaggedRelease({ repo: "o/r", tagPrefix: "data-v", fetchImpl }),
    ).resolves.toBeNull()
    await expect(
      latestTaggedRelease({
        repo: "o/r",
        tagPrefix: "data-v",
        fetchImpl: vi.fn(async () => ok([])),
      }),
    ).resolves.toBeNull()
  })

  it("throws on a refused request rather than reporting no releases", async () => {
    // A token with the wrong scope must not look like "upstream has published nothing",
    // or the caller would silently downgrade to reading a branch.
    const fetchImpl = vi.fn(async () => new Response("no", { status: 403 }))
    await expect(
      latestTaggedRelease({ repo: "o/r", tagPrefix: "data-v", fetchImpl }),
    ).rejects.toThrow("HTTP 403")
  })

  it("sends the token when one is given, and asks for the releases of that repo", async () => {
    const seen: { url: string; init?: RequestInit }[] = []
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), init })
      return ok([])
    }) as unknown as typeof fetch
    await latestTaggedRelease({ repo: "o/r", tagPrefix: "data-v", token: "t0k", fetchImpl })
    expect(seen[0]?.url).toContain("https://api.github.com/repos/o/r/releases")
    expect((seen[0]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer t0k")
  })
})
