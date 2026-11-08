import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"

import {
  type Config,
  type Deps,
  issueTitle,
  main,
  readConfig,
} from "../../scripts/worker-deploy-issue"

const CONFIG: Config = {
  repo: "digitalgroundgame/pragmatic-papers",
  token: "gh-token",
  sha: "abcdef1234567890",
  runUrl: "https://github.com/digitalgroundgame/pragmatic-papers/actions/runs/1",
  target: "staging",
  result: "failure",
}

interface Call {
  method: string
  path: string
  body?: Record<string, unknown>
}

/** A fake GitHub API whose open `ci` issues are `open`; records every call. */
function github(open: { number: number; title: string; pull_request?: unknown }[]) {
  const calls: Call[] = []
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace(`https://api.github.com/repos/${CONFIG.repo}`, "")
    const method = init?.method ?? "GET"
    calls.push({
      method,
      path,
      ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}),
    })
    const body = method === "GET" ? open : { number: 99 }
    return new Response(JSON.stringify(body), { status: 200 })
  }) as unknown as typeof globalThis.fetch
  const deps: Deps = { fetch, log: () => undefined }
  return { calls, deps }
}

describe("worker-deploy-issue.ts", () => {
  it("opens a labelled issue on the first failure", async () => {
    const { calls, deps } = github([])
    await main(CONFIG, deps)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /issues?state=open&labels=ci&per_page=100",
      "POST /issues",
    ])
    expect(calls[1]!.body).toMatchObject({
      title: "Worker deploy failing: staging",
      labels: ["ci"],
      body: expect.stringContaining("failed on abcdef1: https://github.com/"),
    })
  })

  it("comments on the open issue when it fails again", async () => {
    const { calls, deps } = github([{ number: 7, title: issueTitle("staging") }])
    await main(CONFIG, deps)
    expect(calls[1]).toEqual({
      method: "POST",
      path: "/issues/7/comments",
      body: { body: `Still failing on abcdef1: ${CONFIG.runUrl}` },
    })
    expect(calls).toHaveLength(2)
  })

  it("ignores pull requests and the other Worker's issue", async () => {
    const { calls, deps } = github([
      { number: 5, title: issueTitle("staging"), pull_request: {} },
      { number: 6, title: issueTitle("production") },
    ])
    await main(CONFIG, deps)
    expect(calls[1]).toMatchObject({ method: "POST", path: "/issues" })
  })

  it("closes the open issue once a deploy passes", async () => {
    const { calls, deps } = github([{ number: 7, title: issueTitle("staging") }])
    await main({ ...CONFIG, result: "success" }, deps)
    expect(calls.slice(1)).toEqual([
      {
        method: "POST",
        path: "/issues/7/comments",
        body: { body: `Deployed again on abcdef1: ${CONFIG.runUrl}` },
      },
      { method: "PATCH", path: "/issues/7", body: { state: "closed", state_reason: "completed" } },
    ])
  })

  it("does nothing on success with no issue open", async () => {
    const { calls, deps } = github([])
    await main({ ...CONFIG, result: "success" }, deps)
    expect(calls).toHaveLength(1)
  })

  it("does nothing when the deploy was cancelled", async () => {
    const { calls, deps } = github([])
    await main({ ...CONFIG, result: "cancelled" }, deps)
    expect(calls).toHaveLength(0)
  })

  it("fails loudly when the API refuses", async () => {
    const deps: Deps = {
      fetch: (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch,
      log: () => undefined,
    }
    await expect(main(CONFIG, deps)).rejects.toThrow("403 nope")
  })

  it("reads its settings from the environment", () => {
    expect(
      readConfig({
        GITHUB_REPOSITORY: CONFIG.repo,
        GITHUB_TOKEN: CONFIG.token,
        GITHUB_SHA: CONFIG.sha,
        RUN_URL: CONFIG.runUrl,
        TARGET: "staging",
        RESULT: "failure",
      }),
    ).toEqual(CONFIG)
    expect(() => readConfig({})).toThrow("GITHUB_REPOSITORY is not set")
  })
})

describe("worker.yml's report job", () => {
  const workflow = readFileSync(resolve(__dirname, "../../.github/workflows/worker.yml"), "utf-8")
  const job = workflow.slice(workflow.indexOf("\n  report:"))

  it("runs after every deploy that wasn't skipped, with only issue access", () => {
    expect(job).toContain("needs: deploy")
    expect(job).toContain("if: always() && needs.deploy.result != 'skipped'")
    expect(job).toContain("issues: write")
    expect(job).toContain("RESULT: ${{ needs.deploy.result }}")
    expect(job).toContain("run: node scripts/worker-deploy-issue.ts")
  })
})
