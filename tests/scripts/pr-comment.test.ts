import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { prCommentTarget, upsertPrComment } from "../../scripts/pr-comment"

const target = { repo: "owner/repo", prNumber: 42, token: "t0ken" }

const reply = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response

const comments = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: offset + i, body: `comment ${offset + i}` }))

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("prCommentTarget", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GITHUB_REPOSITORY: "owner/repo",
    GITHUB_TOKEN: "t0ken",
    PR_NUMBER: "42",
  }

  it("names the PR from the run's environment", () => {
    expect(prCommentTarget(env)).toEqual(target)
  })

  it("is null outside a pull_request run", () => {
    expect(prCommentTarget({ ...env, PR_NUMBER: "" })).toBeNull()
    expect(prCommentTarget({ ...env, PR_NUMBER: "abc" })).toBeNull()
    expect(prCommentTarget({ ...env, PR_NUMBER: "0" })).toBeNull()
    expect(prCommentTarget({ ...env, GITHUB_TOKEN: undefined })).toBeNull()
    expect(prCommentTarget({ ...env, GITHUB_REPOSITORY: undefined })).toBeNull()
  })
})

describe("upsertPrComment", () => {
  it("posts a new comment, tagged with the marker, when the PR has none", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(reply(comments(3)))
      .mockResolvedValueOnce(reply({ id: 99 }))

    await upsertPrComment(target, "bundle-size", "## Bundle size")

    const [listUrl, listInit] = vi.mocked(fetch).mock.calls[0]!
    expect(listUrl).toBe(
      "https://api.github.com/repos/owner/repo/issues/42/comments?per_page=100&page=1",
    )
    expect(listInit?.headers).toMatchObject({ Authorization: "Bearer t0ken" })

    const [url, init] = vi.mocked(fetch).mock.calls[1]!
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/42/comments")
    expect(init?.method).toBe("POST")
    expect(JSON.parse(init?.body as string)).toEqual({
      body: "<!-- bundle-size -->\n## Bundle size",
    })
  })

  it("edits its own comment, found by the marker, rather than adding another", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        reply([
          { id: 1, body: "<!-- lighthouse -->\nold Lighthouse report" },
          { id: 2, body: "<!-- bundle-size -->\nold bundle report" },
        ]),
      )
      .mockResolvedValueOnce(reply({ id: 2 }))

    await upsertPrComment(target, "bundle-size", "new bundle report")

    const [url, init] = vi.mocked(fetch).mock.calls[1]!
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/comments/2")
    expect(init?.method).toBe("PATCH")
  })

  it("pages through a long thread, and stops at the page that has the comment", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(reply(comments(100)))
      .mockResolvedValueOnce(
        reply([...comments(5, 100), { id: 500, body: "<!-- bundle-size -->\nold" }]),
      )
      .mockResolvedValueOnce(reply({ id: 500 }))

    await upsertPrComment(target, "bundle-size", "new")

    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      "https://api.github.com/repos/owner/repo/issues/42/comments?per_page=100&page=1",
      "https://api.github.com/repos/owner/repo/issues/42/comments?per_page=100&page=2",
      "https://api.github.com/repos/owner/repo/issues/comments/500",
    ])
  })

  it("posts once a full last page turns out to be the end", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(reply(comments(100)))
      .mockResolvedValueOnce(reply([]))
      .mockResolvedValueOnce(reply({ id: 1 }))

    await upsertPrComment(target, "bundle-size", "new")

    expect(vi.mocked(fetch).mock.calls[2]![1]?.method).toBe("POST")
  })

  it("throws with GitHub's answer when listing or writing fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ message: "Bad credentials" }, false, 401))
    await expect(upsertPrComment(target, "m", "x")).rejects.toThrow("GitHub API 401")

    vi.mocked(fetch)
      .mockResolvedValueOnce(reply([]))
      .mockResolvedValueOnce(reply({ message: "Resource not accessible" }, false, 403))
    await expect(upsertPrComment(target, "m", "x")).rejects.toThrow(
      /GitHub API 403: .*Resource not accessible/,
    )
  })
})
