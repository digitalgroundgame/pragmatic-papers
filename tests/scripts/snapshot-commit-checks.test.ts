import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  type CheckRun,
  COPIED_CHECKS,
  type Deps,
  main,
  NOT_COPIED,
  POLL_MS,
  WAIT_MS,
} from "../../scripts/snapshot-commit-checks"

const PARENT = "714dbf51b4b97a00b4458045e95f3402b118b86c"
const HEAD = "b401c3eb9aba27074d24408e68a73c227d70cd51"

const ENV = {
  GITHUB_REPOSITORY: "org/repo",
  GITHUB_TOKEN: "token",
  PARENT_SHA: PARENT,
  HEAD_SHA: HEAD,
  RUN_URL: "https://github.com/org/repo/actions/runs/1",
}

let nextId = 1
const run = (name: string, conclusion: string | null, status = "completed"): CheckRun => {
  const id = nextId++
  return { id, name, status, conclusion, html_url: `https://github.com/org/repo/job/${id}` }
}

/** ci.yml's four checks, all passing. */
const ci = () => [
  run("Static checks", "success"),
  run("Unit tests", "success"),
  run("Integration tests", "success"),
  run("Storybook", "success"),
]

/**
 * A fake GitHub. `polls` lists what PARENT_SHA's check runs are on each poll
 * (the last repeats); every report is recorded.
 */
function fake(...polls: CheckRun[][]) {
  const reported: Record<string, unknown>[] = []
  const logs: string[] = []
  let calls = 0
  let clock = 0
  const deps: Deps = {
    fetch: (async (input: string, init?: RequestInit) => {
      const url = new URL(input)
      if (init?.method === "POST") {
        reported.push(JSON.parse(init.body as string))
        return new Response("{}")
      }
      expect(url.pathname).toBe(`/repos/org/repo/commits/${PARENT}/check-runs`)
      expect(url.searchParams.get("app_id")).toBe("15368")
      const runs = polls[Math.min(calls++, polls.length - 1)] ?? []
      return Response.json({ check_runs: runs })
    }) as typeof fetch,
    log: (message) => logs.push(message),
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
  }
  return { deps, reported, logs, polls: () => calls, elapsed: () => clock }
}

const conclusions = (reported: Record<string, unknown>[]) =>
  Object.fromEntries(reported.map((r) => [r.name, r.conclusion]))

describe("snapshot-commit-checks", () => {
  it("copies each check's real result from the parent, failures included", async () => {
    const gh = fake([
      run("Static checks", "success"),
      run("Unit tests", "failure"),
      run("Integration tests", "success"),
      run("Storybook", "skipped"),
      run("Bundle size", "success"),
      run("Lighthouse", "neutral"),
      run("Detect changes", "success"),
      run("Deploy preview", "success"),
    ])

    expect(await main(ENV, gh.deps)).toBe(0)

    expect(conclusions(gh.reported)).toEqual({
      "E2E tests": "success",
      "Static checks": "success",
      "Unit tests": "failure",
      "Integration tests": "success",
      Storybook: "skipped",
      "Bundle size": "success",
      Lighthouse: "neutral",
    })
    expect(gh.reported.every((r) => r.head_sha === HEAD && r.status === "completed")).toBe(true)
    const unit = gh.reported.find((r) => r.name === "Unit tests")
    expect(unit).toMatchObject({ output: { title: "failure on 714dbf5" } })
    expect(unit?.details_url).toMatch(/^https:\/\/github\.com\/org\/repo\/job\/\d+$/)
  })

  it("takes the newest run when a check was re-run", async () => {
    const failed = run("Unit tests", "failure")
    const gh = fake([
      ...ci().filter((r) => r.name !== "Unit tests"),
      failed,
      run("Unit tests", "success"),
    ])
    await main(ENV, gh.deps)
    expect(conclusions(gh.reported)["Unit tests"]).toBe("success")
  })

  it("waits for checks the parent is still running, or hasn't started", async () => {
    const gh = fake(
      [run("Static checks", null, "in_progress"), run("Lighthouse", null, "queued")],
      [...ci().slice(1), run("Static checks", null, "in_progress"), run("Lighthouse", "success")],
      [...ci().slice(1), run("Static checks", "failure"), run("Lighthouse", "success")],
    )
    await main(ENV, gh.deps)
    expect(gh.polls()).toBe(3)
    expect(gh.elapsed()).toBe(2 * POLL_MS)
    expect(conclusions(gh.reported)).toMatchObject({
      "Static checks": "failure",
      Lighthouse: "success",
    })
  })

  it("leaves a check unreported when the parent has no finished result in time", async () => {
    const gh = fake([...ci().slice(1), run("Static checks", null, "in_progress")])

    expect(await main(ENV, gh.deps)).toBe(0)

    expect(conclusions(gh.reported)["Static checks"]).toBeUndefined()
    expect(conclusions(gh.reported)["Unit tests"]).toBe("success")
    expect(gh.elapsed()).toBeGreaterThanOrEqual(WAIT_MS)
    expect(gh.elapsed()).toBeLessThan(WAIT_MS + POLL_MS)
    expect(gh.logs).toContainEqual(expect.stringContaining("::warning::Static checks"))
  })

  it("leaves a ci.yml check unreported when the parent never ran it", async () => {
    const gh = fake(ci().slice(1))
    await main(ENV, gh.deps)
    expect(conclusions(gh.reported)["Static checks"]).toBeUndefined()
    expect(gh.logs).toContainEqual(expect.stringContaining("::warning::Static checks"))
  })

  it("skips a check that only runs on some PRs when the parent didn't run it", async () => {
    const gh = fake(ci())
    await main(ENV, gh.deps)
    expect(gh.polls()).toBe(1)
    expect(conclusions(gh.reported).actionlint).toBeUndefined()
    expect(gh.logs.filter((l) => l.startsWith("::warning::"))).toEqual([])
  })

  it("doesn't copy a conclusion that needs a person, like action_required", async () => {
    const gh = fake([...ci().slice(1), run("Static checks", "action_required")])
    await main(ENV, gh.deps)
    expect(conclusions(gh.reported)["Static checks"]).toBeUndefined()
  })

  it("fails without its env", async () => {
    const gh = fake()
    expect(await main({ ...ENV, PARENT_SHA: "" }, gh.deps)).toBe(1)
    expect(gh.logs).toEqual(["::error::Missing required env var PARENT_SHA"])
    expect(gh.reported).toEqual([])
  })
})

describe("the copied and not-copied lists", () => {
  const WORKFLOWS = ".github/workflows"

  /** The name of every job in a workflow a pull request can start. */
  const prJobs: Record<string, string[]> = Object.fromEntries(
    readdirSync(WORKFLOWS)
      .filter((file) => file.endsWith(".yml"))
      .map((file) => [file, readFileSync(path.join(WORKFLOWS, file), "utf8")] as const)
      .filter(([, yaml]) => /^ {2}pull_request(_target)?:/m.test(yaml))
      .map(([file, yaml]) => [file, [...yaml.matchAll(/^ {4}name: (.+)$/gm)].map((m) => m[1]!)]),
  )

  it("classify every job a PR runs", () => {
    const unclassified = Object.entries(prJobs).flatMap(([file, names]) =>
      names
        .filter((name) => !(name in COPIED_CHECKS) && !(name in NOT_COPIED))
        .map((name) => `${file}: ${name}`),
    )
    // Add each to COPIED_CHECKS if a commit that only adds PNGs can't change
    // its verdict, or to NOT_COPIED with the reason it isn't.
    expect(unclassified).toEqual([])
  })

  it("name only jobs that exist", () => {
    const all = new Set(Object.values(prJobs).flat())
    const stale = [...Object.keys(COPIED_CHECKS), ...Object.keys(NOT_COPIED)].filter(
      (name) => !all.has(name),
    )
    expect(stale).toEqual([])
  })
})
