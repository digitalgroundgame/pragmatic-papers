import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  collapsible,
  prCommentTarget,
  readSections,
  REPORT_MARKER,
  postPrReportSection,
  withSection,
} from "../../scripts/pr-report"

const target = { repo: "owner/repo", prNumber: 42, token: "t0ken" }
const API = "https://api.github.com/repos/owner/repo"

/**
 * A PR's comments, served through a mocked `fetch` the way GitHub's REST API does. CI's
 * token writes as a bot; a comment marked `person` was written by someone.
 */
/** The PR's description, which links the report comment. */
let description = ""

function fakeGitHub(initial: { id: number; body: string; person?: boolean }[] = []) {
  const comments = new Map(initial.map((comment) => [comment.id, comment.body]))
  description = "## Context"
  const people = new Set(initial.filter((comment) => comment.person).map(({ id }) => id))
  let nextId = Math.max(0, ...comments.keys()) + 1
  const json = (body: unknown, status = 200) =>
    ({
      ok: status < 400,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as Response
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    const list = /\/issues\/42\/comments\?per_page=100&page=(\d+)$/.exec(url)
    if (list && method === "GET") {
      const page = Number(list[1])
      const all = [...comments].map(([id, body]) => ({
        id,
        body,
        user: { type: people.has(id) ? "User" : "Bot" },
      }))
      return json(all.slice((page - 1) * 100, page * 100))
    }
    if (url === `${API}/issues/42/comments` && method === "POST") {
      const id = nextId++
      comments.set(id, JSON.parse(init!.body as string).body)
      return json({ id }, 201)
    }
    if (url === `${API}/pulls/42`) {
      if (method === "PATCH") description = JSON.parse(init!.body as string).body
      return json({ body: description })
    }
    const one = /\/issues\/comments\/(\d+)$/.exec(url)
    if (one && comments.has(Number(one[1]))) {
      if (method === "PATCH") {
        comments.set(Number(one[1]), JSON.parse(init!.body as string).body)
        return json({ id: Number(one[1]) })
      }
      if (method === "DELETE") {
        comments.delete(Number(one[1]))
        return json(null, 204)
      }
    }
    return json({ message: "Not Found" }, 404)
  })
  return comments
}

const noWait = async () => undefined

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

describe("collapsible", () => {
  it("is closed unless asked to start open", () => {
    const args = { title: "Bundle size", summary: "no change", body: "| a |" }
    expect(collapsible({ ...args, open: false })).toBe(
      "<details><summary><strong>Bundle size</strong>: no change</summary>\n\n| a |\n\n</details>",
    )
    expect(collapsible({ ...args, open: true })).toMatch(/^<details open>/)
  })
})

describe("withSection", () => {
  it("keeps the other sections, in a fixed order whoever wrote last", () => {
    let body = withSection(undefined, "lighthouse", "LH")
    body = withSection(body, "coverage", "COV")
    body = withSection(body, "bundle-size", "BS")
    body = withSection(body, "lighthouse", "LH 2")
    expect(body).toBe(
      [
        REPORT_MARKER,
        "<!-- section:coverage -->\nCOV\n<!-- /section:coverage -->",
        "<!-- section:bundle-size -->\nBS\n<!-- /section:bundle-size -->",
        "<!-- section:lighthouse -->\nLH 2\n<!-- /section:lighthouse -->",
      ].join("\n\n"),
    )
    expect(readSections(body)).toEqual(
      new Map([
        ["coverage", "COV"],
        ["bundle-size", "BS"],
        ["lighthouse", "LH 2"],
      ]),
    )
  })

  it("drops a section that's no longer registered", () => {
    const body = withSection(
      `${REPORT_MARKER}\n\n<!-- section:retired -->\nold\n<!-- /section:retired -->`,
      "coverage",
      "COV",
    )
    expect(body).not.toContain("retired")
  })

  it("drops what an older comment had outside any section", () => {
    const body = withSection(`${REPORT_MARKER}\n<h2>Coverage Report</h2>`, "coverage", "new")
    expect(readSections(body)).toEqual(new Map([["coverage", "new"]]))
    expect(body).not.toContain("Coverage Report")
  })

  it("reads a section back from a body GitHub returned with CRLFs", () => {
    const body = withSection(undefined, "coverage", "a\nb").replaceAll("\n", "\r\n")
    expect(readSections(body).get("coverage")).toBe("a\nb")
  })
})

describe("postPrReportSection", () => {
  it("creates the report comment when the PR has none", async () => {
    const comments = fakeGitHub([{ id: 1, body: "a person's comment", person: true }])

    await postPrReportSection(target, "bundle-size", "BS", { sleep: noWait })

    expect(comments.get(1)).toBe("a person's comment")
    expect(readSections(comments.get(2))).toEqual(new Map([["bundle-size", "BS"]]))
    expect(vi.mocked(fetch).mock.calls[0]![1]?.headers).toMatchObject({
      Authorization: "Bearer t0ken",
    })
  })

  it("links the comment as Coverage at the top of the PR's description", async () => {
    fakeGitHub([{ id: 7, body: withSection(undefined, "coverage", "COV") }])

    await postPrReportSection(target, "lighthouse", "LH", { sleep: noWait })

    expect(description).toBe(
      "<!-- pr-links -->\n[Coverage](https://github.com/owner/repo/pull/42#issuecomment-7)\n<!-- /pr-links -->\n\n## Context",
    )
  })

  it("replaces only its own section of an existing comment", async () => {
    const comments = fakeGitHub([
      { id: 5, body: withSection(withSection(undefined, "coverage", "COV"), "lighthouse", "old") },
    ])

    await postPrReportSection(target, "lighthouse", "new", { sleep: noWait })

    expect([...comments.keys()]).toEqual([5])
    expect(readSections(comments.get(5))).toEqual(
      new Map([
        ["coverage", "COV"],
        ["lighthouse", "new"],
      ]),
    )
  })

  it("finds the comment past the first page of a long thread", async () => {
    const people = Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      body: `comment ${i}`,
      person: true,
    }))
    const comments = fakeGitHub([
      ...people,
      { id: 500, body: withSection(undefined, "lighthouse", "x") },
    ])

    await postPrReportSection(target, "coverage", "COV", { sleep: noWait })

    expect(comments.size).toBe(121)
    expect(readSections(comments.get(500)).get("coverage")).toBe("COV")
  })

  it("deletes the report's old, separate comment", async () => {
    const comments = fakeGitHub([
      { id: 1, body: "<!-- bundle-size -->\n## Bundle size" },
      { id: 2, body: "<!-- lighthouse -->\n## Lighthouse" },
    ])

    await postPrReportSection(target, "bundle-size", "BS", { sleep: noWait })

    expect([...comments.keys()]).toEqual([2, 3])
  })

  it("leaves alone a person's comment that quotes a marker", async () => {
    const review = `Checked that \`<!-- bundle-size -->\` and \`${REPORT_MARKER}\` aren't read elsewhere.`
    const comments = fakeGitHub([{ id: 1, body: review, person: true }])

    await postPrReportSection(target, "bundle-size", "BS", { sleep: noWait })

    expect(comments.get(1)).toBe(review)
    expect(readSections(comments.get(2))).toEqual(new Map([["bundle-size", "BS"]]))
  })

  it("writes its section again when another job's write dropped it", async () => {
    const comments = fakeGitHub([{ id: 1, body: withSection(undefined, "coverage", "COV") }])
    // Another job read the comment before this one wrote, and writes it back after.
    const before = comments.get(1)!
    let raced = false
    const sleep = async () => {
      if (raced) return
      raced = true
      comments.set(1, withSection(before, "lighthouse", "LH"))
    }

    await postPrReportSection(target, "bundle-size", "BS", { sleep })

    expect(readSections(comments.get(1))).toEqual(
      new Map([
        ["coverage", "COV"],
        ["bundle-size", "BS"],
        ["lighthouse", "LH"],
      ]),
    )
  })

  it("moves its section to the older comment when two jobs created one at once", async () => {
    const comments = fakeGitHub()
    let raced = false
    const sleep = async () => {
      if (raced) return
      raced = true
      // Another job posted its own comment just before this one did.
      comments.set(0, withSection(undefined, "coverage", "COV"))
    }

    await postPrReportSection(target, "lighthouse", "LH", { sleep })

    expect([...comments.keys()]).toEqual([0])
    expect(readSections(comments.get(0))).toEqual(
      new Map([
        ["coverage", "COV"],
        ["lighthouse", "LH"],
      ]),
    )
  })

  it("gives up, saying so, when its section keeps being overwritten", async () => {
    const comments = fakeGitHub([{ id: 1, body: withSection(undefined, "coverage", "COV") }])
    const sleep = async () => {
      comments.set(1, withSection(undefined, "coverage", "COV"))
    }

    await expect(postPrReportSection(target, "lighthouse", "LH", { sleep })).rejects.toThrow(
      "another job kept overwriting the lighthouse section",
    )
  })

  it("throws with GitHub's answer when listing or writing fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Bad credentials",
    } as Response)
    await expect(postPrReportSection(target, "coverage", "x", { sleep: noWait })).rejects.toThrow(
      "GitHub API 401: Bad credentials",
    )
  })
})
