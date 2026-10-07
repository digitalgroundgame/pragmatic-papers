import { describe, expect, it } from "vitest"

import {
  type CheckRun,
  COPIED_CHECKS,
  type Deps,
  main,
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

const run = (id: number, conclusion: string | null, status = "completed"): CheckRun => ({
  id,
  status,
  conclusion,
  html_url: `https://github.com/org/repo/actions/runs/9/job/${id}`,
})

/**
 * A fake GitHub. `parent` answers each poll for a check on PARENT_SHA, one
 * list per poll (the last repeats); every report is recorded.
 */
function fake(parent: Record<string, CheckRun[][]>) {
  const reported: Record<string, unknown>[] = []
  const logs: string[] = []
  const polls: Record<string, number> = {}
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
      const name = url.searchParams.get("check_name")!
      const answers = parent[name] ?? [[]]
      const i = Math.min(polls[name] ?? 0, answers.length - 1)
      polls[name] = (polls[name] ?? 0) + 1
      return Response.json({ check_runs: answers[i] })
    }) as typeof fetch,
    log: (message) => logs.push(message),
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
  }
  return { deps, reported, logs, polls, elapsed: () => clock }
}

const conclusions = (reported: Record<string, unknown>[]) =>
  Object.fromEntries(reported.map((r) => [r.name, r.conclusion]))

describe("snapshot-commit-checks", () => {
  it("copies each check's real result from the parent, failures included", async () => {
    const gh = fake({
      "Static checks": [[run(1, "success")]],
      "Unit tests": [[run(2, "failure")]],
      "Integration tests": [[run(3, "success")]],
      Storybook: [[run(4, "skipped")]],
    })

    expect(await main(ENV, gh.deps)).toBe(0)

    expect(conclusions(gh.reported)).toEqual({
      "E2E tests": "success",
      "Static checks": "success",
      "Unit tests": "failure",
      "Integration tests": "success",
      Storybook: "skipped",
    })
    expect(gh.reported.every((r) => r.head_sha === HEAD && r.status === "completed")).toBe(true)
    expect(gh.reported.find((r) => r.name === "Unit tests")).toMatchObject({
      details_url: run(2, null).html_url,
      output: { title: "failure on 714dbf5" },
    })
  })

  it("takes the newest run when a check was re-run", async () => {
    const gh = fake({ "Unit tests": [[run(7, "success"), run(5, "failure")]] })
    await main(ENV, gh.deps)
    expect(conclusions(gh.reported)["Unit tests"]).toBe("success")
  })

  it("waits for a check the parent is still running", async () => {
    const gh = fake({
      "Static checks": [
        [run(1, null, "in_progress")],
        [run(1, null, "in_progress")],
        [run(1, "failure")],
      ],
    })
    await main(ENV, gh.deps)
    expect(conclusions(gh.reported)["Static checks"]).toBe("failure")
    expect(gh.polls["Static checks"]).toBe(3)
  })

  it("leaves a check unreported when the parent has no finished result in time", async () => {
    const gh = fake(
      Object.fromEntries(COPIED_CHECKS.map((name) => [name, [[run(1, null, "in_progress")]]])),
    )

    expect(await main(ENV, gh.deps)).toBe(0)

    expect(Object.keys(conclusions(gh.reported))).toEqual(["E2E tests"])
    expect(gh.elapsed()).toBeGreaterThanOrEqual(WAIT_MS)
    // One deadline for all of them, not one each.
    expect(gh.elapsed()).toBeLessThan(WAIT_MS + POLL_MS)
    expect(gh.logs.filter((l) => l.startsWith("::warning::"))).toHaveLength(COPIED_CHECKS.length)
  })

  it("leaves a check unreported when the parent never ran it", async () => {
    const gh = fake({ "Static checks": [[run(1, "success")]] })
    await main(ENV, gh.deps)
    expect(conclusions(gh.reported)["Unit tests"]).toBeUndefined()
    expect(gh.logs).toContainEqual(expect.stringContaining("::warning::Unit tests"))
  })

  it("doesn't copy a conclusion that needs a person, like action_required", async () => {
    const gh = fake({ "Unit tests": [[run(1, "action_required")]] })
    await main(ENV, gh.deps)
    expect(conclusions(gh.reported)["Unit tests"]).toBeUndefined()
  })

  it("fails without its env", async () => {
    const gh = fake({})
    expect(await main({ ...ENV, PARENT_SHA: "" }, gh.deps)).toBe(1)
    expect(gh.logs).toEqual(["::error::Missing required env var PARENT_SHA"])
    expect(gh.reported).toEqual([])
  })
})
