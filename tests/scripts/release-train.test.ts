import { describe, expect, it } from "vitest"

import { bumpMessage as releaseBumpMessage } from "../../scripts/release-lib"
import {
  bumpMessage,
  bumpVersion,
  type Commit,
  compareVersions,
  type Deps,
  describePlan,
  main,
  parseLog,
  planTrain,
  releaseBody,
  releaseLevel,
  releaseNotes,
  withVersion,
} from "../../scripts/release-train"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-10-03T16:00:00Z") // a Saturday

let n = 0
/** A commit that landed on dev `daysAgo` days before NOW. */
const commit = (subject: string, daysAgo = 0): Commit => ({
  sha: String(++n).padStart(40, "0"),
  date: new Date(NOW - daysAgo * DAY).toISOString(),
  subject,
})
const plan = (commits: Commit[], mainVersion = "2.6.0", soakDays = 4, conflicting: Commit[] = []) =>
  planTrain({
    mainVersion,
    commits,
    now: NOW,
    soakDays,
    mergesCleanly: (sha) => !conflicting.some((c) => c.sha === sha),
  })

describe("versions", () => {
  it("compares numerically, not as strings", () => {
    expect(compareVersions("2.10.0", "2.9.9")).toBeGreaterThan(0)
    expect(compareVersions("2.6.0", "2.6.0")).toBe(0)
    expect(compareVersions("1.9.0", "2.0.0")).toBeLessThan(0)
  })

  it.each([
    ["major", "3.0.0"],
    ["minor", "2.7.0"],
    ["patch", "2.6.2"],
  ] as const)("bumps a %s", (level, next) => {
    expect(bumpVersion("2.6.1", level)).toBe(next)
  })

  it("writes the same bump subject as pnpm release", () => {
    expect(bumpMessage("2.7.0")).toBe(releaseBumpMessage("v2.7.0"))
  })

  it("sets the version and leaves the rest of package.json as written", () => {
    const pkg = '{\n  "name": "pp",\n  "version": "2.6.0",\n  "dependencies": { "x": "2.6.0" }\n}\n'
    expect(withVersion(pkg, "2.7.0")).toBe(pkg.replace('"version": "2.6.0"', '"version": "2.7.0"'))
  })
})

describe("releaseLevel", () => {
  it("is major for a `!`, whatever the type", () => {
    expect(releaseLevel([commit("feat: a"), commit("fix(api)!: drop v1")])).toBe("major")
  })

  it("is minor for any feature", () => {
    expect(releaseLevel([commit("fix: a"), commit("feat(media): b (#12)")])).toBe("minor")
  })

  it("is a patch otherwise, Dependabot's capitalised types and untyped subjects included", () => {
    expect(releaseLevel([commit("Chore(deps): Bump x"), commit("Back-merge v2.0.9 (#588)")])).toBe(
      "patch",
    )
  })

  it("ignores a `!` that isn't in the type", () => {
    expect(releaseLevel([commit("fix: stop crashing!")])).toBe("patch")
  })
})

describe("releaseNotes", () => {
  it("groups by type, breaking first, keeping order", () => {
    const notes = releaseNotes([
      commit("fix: b (#3)"),
      commit("feat!: a (#2)"),
      commit("feat(x): c (#4)"),
      commit("Chore(deps): d (#5)"),
      commit("fix: e (#6)"),
    ])
    expect(notes).toBe(
      [
        "### Breaking changes\n\n- feat!: a (#2)",
        "### Features\n\n- feat(x): c (#4)",
        "### Fixes\n\n- fix: b (#3)\n- fix: e (#6)",
        "### Other changes\n\n- Chore(deps): d (#5)",
      ].join("\n\n"),
    )
  })
})

describe("parseLog", () => {
  it("splits on the unit separator, so subjects may hold anything", () => {
    expect(parseLog("abc\x1f2026-10-01T00:00:00Z\x1ffix: a | b\n")).toEqual([
      { sha: "abc", date: "2026-10-01T00:00:00Z", subject: "fix: a | b" },
    ])
  })
})

describe("planTrain", () => {
  it("cuts the first candidate from everything since main", () => {
    const result = plan([commit("fix: b", 1), commit("feat: a", 9)])
    expect(result.promote).toBeUndefined()
    expect(result.cut).toMatchObject({ version: "2.7.0", from: "2.6.0", level: "minor" })
    expect(result.cut?.commits.map((c) => c.subject)).toEqual(["fix: b", "feat: a"])
  })

  it("promotes a settled candidate and cuts the next from what landed since", () => {
    const after = commit("fix: after", 2)
    const candidate = commit("Bump package.json to v2.7.0 (#950)", 6)
    const before = commit("feat: before", 8)
    const result = plan([after, candidate, before])

    expect(result.promote).toMatchObject({ version: "2.7.0", commit: candidate })
    expect(result.promote?.notes).toEqual([before])
    expect(result.cut).toMatchObject({ version: "2.7.1", from: "2.7.0", commits: [after] })
    expect(result.waiting).toBeUndefined()
  })

  it("waits while the candidate settles, and cuts nothing new", () => {
    const result = plan([commit("feat: after", 1), commit("Bump package.json to v2.7.0", 3)])
    expect(result.promote).toBeUndefined()
    expect(result.cut).toBeUndefined()
    expect(result.waiting).toMatchObject({ version: "2.7.0" })
  })

  it("still promotes an older settled candidate while a newer one settles", () => {
    const result = plan([
      commit("Bump package.json to v2.8.0", 1),
      commit("feat: b", 3),
      commit("Bump package.json to v2.7.0", 8),
      commit("feat: a", 9),
    ])
    expect(result.promote?.version).toBe("2.7.0")
    expect(result.waiting?.version).toBe("2.8.0")
    expect(result.cut).toBeUndefined()
  })

  it("promotes the newest of several settled candidates, holding both", () => {
    const result = plan([
      commit("Bump package.json to v2.8.0", 5),
      commit("feat: b", 6),
      commit("Bump package.json to v2.7.0", 12),
      commit("feat: a", 13),
    ])
    expect(result.promote?.version).toBe("2.8.0")
    expect(result.promote?.notes.map((c) => c.subject)).toEqual(["feat: b", "feat: a"])
  })

  it("counts a candidate a hotfix overtook as released, and cuts past the hotfix", () => {
    const result = plan(
      [commit("Back-merge v2.7.1 (#960)", 2), commit("Bump package.json to v2.7.0", 6)],
      "2.7.1",
    )
    expect(result.promote).toBeUndefined()
    expect(result.cut).toMatchObject({ version: "2.7.2", from: "2.7.1" })
    expect(result.cut?.commits.map((c) => c.subject)).toEqual(["Back-merge v2.7.1 (#960)"])
  })

  it("flags reverts that landed after the candidate", () => {
    const result = plan([
      commit('Revert "feat: a" (#970)', 1),
      commit("Bump package.json to v2.7.0", 5),
      commit("feat: a (#969)", 6),
    ])
    expect(result.promote?.reverts.map((c) => c.subject)).toEqual(['Revert "feat: a" (#970)'])
    expect(releaseBody(result.promote!)).toContain("[!WARNING]")
  })

  it("has nothing to do when dev holds only the released candidate", () => {
    const result = plan([])
    expect(result).toEqual({})
    expect(describePlan(result, "2.6.0")).toContain("nothing to cut")
  })

  it("promotes right away with no wait", () => {
    expect(plan([commit("Bump package.json to v2.7.0", 0)], "2.6.0", 0).promote?.version).toBe(
      "2.7.0",
    )
  })

  describe("a hotfix below the candidate's version", () => {
    // pnpm hotfix 2.6.1 reached main after v2.7.0 was cut, so the candidate
    // and dev both change the "version" line main changed too.
    const fix = commit("fix: c", 1)
    const candidate = commit("Bump package.json to v2.7.0", 6)
    const feature = commit("feat: b", 7)

    it("doesn't promote the conflicting candidate, and cuts nothing until the back-merge", () => {
      const result = plan([fix, candidate, feature], "2.6.1", 4, [fix, candidate])
      expect(result.promote).toBeUndefined()
      expect(result.stale).toMatchObject({ version: "2.7.0" })
      expect(result.waiting).toBeUndefined()
      expect(result.blocked).toBe(true)
      expect(result.cut).toBeUndefined()
      expect(describePlan(result, "2.6.1")).toContain("back-merge the hotfix into dev")
    })

    it("cuts above the stale candidate once dev is back-merged, levelled by all that's unreleased", () => {
      const backMerge = commit("Back-merge v2.6.1 (#980)", 0)
      const result = plan([backMerge, fix, candidate, feature], "2.6.1", 4, [fix, candidate])
      expect(result.blocked).toBeUndefined()
      expect(result.cut).toMatchObject({ version: "2.8.0", from: "2.7.0", level: "minor" })
      expect(result.cut?.commits).toEqual([backMerge, fix])
    })

    it("still waits on a clean candidate that's settling, with a stale one behind it", () => {
      const result = plan(
        [commit("Bump package.json to v2.8.0", 1), commit("Back-merge v2.6.1", 2), candidate],
        "2.6.1",
        4,
        [candidate],
      )
      expect(result.waiting).toMatchObject({ version: "2.8.0" })
      expect(result.stale).toMatchObject({ version: "2.7.0" })
      expect(result.cut).toBeUndefined()
    })
  })
})

// ── main, against a fake GitHub ────────────────────────────────────────────

const DEV_SHA = "d".repeat(40)
const PKG = '{\n  "name": "pp",\n  "version": "2.6.0"\n}\n'

interface Call {
  method: string
  path: string
  body?: Record<string, unknown>
}

function fakeGithub({
  pulls = {},
  branches = [] as string[],
  commitParents = {} as Record<string, string>,
}: {
  pulls?: Record<string, { number: number; head: { ref: string; sha: string } }[]>
  branches?: string[]
  commitParents?: Record<string, string>
}) {
  const calls: Call[] = []
  const respond = (body: unknown, status = 200) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/repos\/o\/r/, "") + url.search
    const method = init?.method ?? "GET"
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    calls.push({ method, path, body })

    if (method === "GET" && path.startsWith("/pulls?")) {
      const base = url.searchParams.get("base") ?? ""
      return respond(
        (pulls[base] ?? []).map((p) => ({
          ...p,
          html_url: `https://github.com/o/r/pull/${p.number}`,
        })),
      )
    }
    if (method === "POST" && path === "/pulls")
      return respond({
        number: 99,
        html_url: "https://github.com/o/r/pull/99",
        head: { ref: body?.head },
      })
    if (method === "GET" && path.startsWith("/git/ref/heads/")) {
      return branches.includes(path.slice("/git/ref/heads/".length))
        ? respond({})
        : respond("Not Found", 404)
    }
    if (method === "GET" && path.startsWith("/contents/package.json")) return respond(PKG)
    if (method === "GET" && path.startsWith("/git/commits/")) {
      const sha = path.slice("/git/commits/".length)
      return respond({ sha, tree: { sha: "tree0" }, parents: [{ sha: commitParents[sha] ?? "x" }] })
    }
    if (method === "POST" && path === "/git/trees") return respond({ sha: "tree1" })
    if (method === "POST" && path === "/git/commits") return respond({ sha: "b".repeat(40) })
    return respond({})
  }) as typeof globalThis.fetch
  return { calls, fetch }
}

function run(
  log: Commit[],
  github: ReturnType<typeof fakeGithub>,
  env: Record<string, string> = {},
  conflicting: Commit[] = [],
) {
  const logs: string[] = []
  const deps: Deps = {
    fetch: github.fetch,
    git: (args) => {
      if (args[0] === "show") return PKG
      if (args[0] === "rev-parse") return `${DEV_SHA}\n`
      if (args[0] === "merge-tree") {
        if (conflicting.some((c) => c.sha === args[3]))
          throw Object.assign(new Error("conflict"), { status: 1 })
        return "tree\n"
      }
      return log.map((c) => [c.sha, c.date, c.subject].join("\x1f")).join("\n")
    },
    now: () => NOW,
    log: (message) => logs.push(message),
    summary: (markdown) => logs.push(markdown),
  }
  return {
    logs,
    code: main({ GITHUB_REPOSITORY: "o/r", GITHUB_TOKEN: "t", ...env }, deps),
  }
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== "GET")

describe("main", () => {
  it("writes nothing on a dry run", async () => {
    const github = fakeGithub({})
    const { code } = run([commit("feat: a", 1)], github, { DRY_RUN: "true" })
    expect(await code).toBe(0)
    expect(github.calls).toEqual([])
  })

  it("opens the release PR at the candidate and the next bump PR on dev's tip", async () => {
    const candidate = commit("Bump package.json to v2.7.0 (#950)", 6)
    const github = fakeGithub({})
    const { code } = run([commit("fix: after (#951)", 2), candidate, commit("feat: a", 8)], github)
    expect(await code).toBe(0)

    expect(writes(github.calls)).toEqual([
      {
        method: "POST",
        path: "/git/refs",
        body: { ref: "refs/heads/release-train/v2.7.0", sha: candidate.sha },
      },
      {
        method: "POST",
        path: "/pulls",
        body: expect.objectContaining({
          title: "Release 2.7.0",
          head: "release-train/v2.7.0",
          base: "main",
        }),
      },
      {
        method: "POST",
        path: "/git/trees",
        body: {
          base_tree: "tree0",
          tree: [
            {
              path: "package.json",
              mode: "100644",
              type: "blob",
              content: PKG.replace("2.6.0", "2.7.1"),
            },
          ],
        },
      },
      {
        method: "POST",
        path: "/git/commits",
        body: { message: "Bump package.json to v2.7.1", tree: "tree1", parents: [DEV_SHA] },
      },
      {
        method: "POST",
        path: "/git/refs",
        body: { ref: "refs/heads/release-train/bump-v2.7.1", sha: "b".repeat(40) },
      },
      {
        method: "POST",
        path: "/pulls",
        body: expect.objectContaining({
          title: "Bump package.json to v2.7.1",
          head: "release-train/bump-v2.7.1",
          base: "dev",
        }),
      },
    ])
  })

  it("refreshes its open bump PR and closes a stale one as superseded", async () => {
    const github = fakeGithub({
      pulls: {
        dev: [
          { number: 7, head: { ref: "release-train/bump-v2.6.1", sha: "s".repeat(40) } },
          { number: 8, head: { ref: "release-train/bump-v2.7.0", sha: "c".repeat(40) } },
          { number: 9, head: { ref: "someone/else", sha: "e".repeat(40) } },
        ],
      },
      branches: ["release-train/bump-v2.7.0"],
    })
    const { code } = run([commit("feat: a", 1)], github)
    expect(await code).toBe(0)

    const w = writes(github.calls)
    expect(w).toContainEqual({
      method: "PATCH",
      path: "/git/refs/heads/release-train/bump-v2.7.0",
      body: { sha: "b".repeat(40), force: true },
    })
    expect(w).toContainEqual(expect.objectContaining({ method: "PATCH", path: "/pulls/8" }))
    expect(w).toContainEqual({
      method: "POST",
      path: "/issues/7/comments",
      body: { body: "Superseded by #8." },
    })
    expect(w).toContainEqual({ method: "PATCH", path: "/pulls/7", body: { state: "closed" } })
    expect(w).toContainEqual({
      method: "DELETE",
      path: "/git/refs/heads/release-train/bump-v2.6.1",
    })
    expect(w.some((c) => c.path.includes("/9"))).toBe(false)
  })

  it("leaves a bump PR already on dev's tip alone, so its approval stands", async () => {
    const head = "c".repeat(40)
    const github = fakeGithub({
      pulls: { dev: [{ number: 8, head: { ref: "release-train/bump-v2.7.0", sha: head } }] },
      commitParents: { [head]: DEV_SHA },
    })
    const { code } = run([commit("feat: a", 1)], github)
    expect(await code).toBe(0)
    expect(writes(github.calls).map((c) => `${c.method} ${c.path}`)).toEqual(["PATCH /pulls/8"])
  })

  it("closes the release PR of a candidate a hotfix made conflict", async () => {
    const fix = commit("fix: c", 1)
    const candidate = commit("Bump package.json to v2.7.0", 6)
    const github = fakeGithub({
      pulls: {
        main: [{ number: 5, head: { ref: "release-train/v2.7.0", sha: candidate.sha } }],
      },
    })
    const { code } = run([fix, candidate], github, {}, [fix, candidate])
    expect(await code).toBe(0)
    expect(writes(github.calls)).toEqual([
      {
        method: "POST",
        path: "/issues/5/comments",
        body: { body: expect.stringContaining("a hotfix reached main") },
      },
      { method: "PATCH", path: "/pulls/5", body: { state: "closed" } },
      { method: "DELETE", path: "/git/refs/heads/release-train/v2.7.0" },
    ])
  })

  it("fails on git errors other than a conflict", async () => {
    const logs: string[] = []
    const candidate = commit("Bump package.json to v2.7.0", 6)
    const code = await main(
      { GITHUB_REPOSITORY: "o/r", GITHUB_TOKEN: "t" },
      {
        fetch: fakeGithub({}).fetch,
        git: (args) => {
          if (args[0] === "show") return PKG
          if (args[0] === "merge-tree")
            throw Object.assign(new Error("bad object"), { status: 128 })
          return [candidate.sha, candidate.date, candidate.subject].join("\x1f")
        },
        now: () => NOW,
        log: (message) => logs.push(message),
        summary: (markdown) => logs.push(markdown),
      },
    )
    expect(code).toBe(1)
    expect(logs.join("\n")).toContain("bad object")
  })

  it("fails on a bad SOAK_DAYS", async () => {
    const { code, logs } = run([], fakeGithub({}), { SOAK_DAYS: "soon" })
    expect(await code).toBe(1)
    expect(logs.join("\n")).toContain("SOAK_DAYS")
  })
})
