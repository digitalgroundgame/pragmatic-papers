// Reports the checks on a commit that playwright.yml or update-snapshots.yml
// pushes to a PR branch. A push made with GITHUB_TOKEN starts runs that wait
// for a maintainer's approval, so without these the commit would have no
// results until someone approves them.
//
// The commit only adds screenshot baselines, so each check in COPIED_CHECKS is
// copied from the commit before it (PARENT_SHA) with that commit's real
// conclusion: a failing check stays failing. A check the parent hasn't
// finished within WAIT_MS is left unreported, and the waiting run decides it
// once approved. "E2E tests" is reported as passing: the calling job tested
// PARENT_SHA and only calls this when nothing but the new baselines failed.
//
// Env: GITHUB_REPOSITORY, GITHUB_TOKEN, PARENT_SHA, HEAD_SHA, RUN_URL.

import { pathToFileURL } from "node:url"

/**
 * Checks whose verdict a commit that only adds PNGs can't change. Those in
 * ci.yml run on every PR, so they're waited for even before they show up; the
 * rest are copied when the parent has them.
 */
export const COPIED_CHECKS = {
  "Static checks": "always",
  "Unit tests": "always",
  "Integration tests": "always",
  Storybook: "always",
  "Page speed": "when-present",
  actionlint: "when-present",
  "Cloudflare rules": "when-present",
  "Sync labels from .github/labels.yml": "when-present",
} as const

/**
 * Every other job a PR can run, and why it isn't copied. A job a PR runs
 * must be in one list or the other (tests/scripts/snapshot-commit-checks.test.ts
 * reads the workflows), so a new check is a decision, not an oversight.
 */
export const NOT_COPIED = {
  "E2E tests": "reported by the job that pushed the commit",
  "Detect changes": "plans this commit's own run",
  "Detect E2E changes": "plans this commit's own run",
  "Build image": "deploys, doesn't check",
  "Deploy preview": "deploys, doesn't check",
  "Deploy Storybook": "deploys, doesn't check",
  "Remove preview": "runs when the PR closes",
  "Retire Storybook preview": "runs when the PR closes",
  "Apply Cloudflare rules": "doesn't run on PRs",
  "Assign PR author to unassigned linked issues": "edits issues, doesn't check",
  "PR automation": "starts other workflows and edits the PR, doesn't check",
} as const

/** The GitHub Actions app, which both the workflows' jobs and this script report as. */
export const ACTIONS_APP_ID = 15368

/** Conclusions a check run can be created with that mean the same thing on the new commit. */
const COPYABLE = new Set(["success", "failure", "neutral", "cancelled", "skipped", "timed_out"])

export const WAIT_MS = 20 * 60 * 1000
export const POLL_MS = 30 * 1000

export type Env = Record<string, string | undefined>

export interface CheckRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url: string
}

export interface Deps {
  fetch: typeof fetch
  log: (message: string) => void
  sleep: (ms: number) => Promise<void>
  now: () => number
}

function required(env: Env, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

function github(deps: Deps, repo: string, token: string) {
  const json = async <T>(path: string, init: { method?: string; body?: unknown } = {}) => {
    const url = `https://api.github.com/repos/${repo}${path}`
    const res = await deps.fetch(url, {
      method: init.method,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body !== undefined && { "Content-Type": "application/json" }),
      },
    })
    if (!res.ok) {
      throw new Error(
        `${init.method ?? "GET"} ${url} → ${res.status}: ${(await res.text()).slice(0, 500)}`,
      )
    }
    return (await res.json()) as T
  }
  return {
    /** The newest run of each copied check on a commit. */
    latest: async (sha: string) => {
      const newest = new Map<string, CheckRun>()
      for (let page = 1; page <= 10; page++) {
        const { check_runs } = await json<{ check_runs: CheckRun[] }>(
          `/commits/${sha}/check-runs?app_id=${ACTIONS_APP_ID}&filter=latest&per_page=100&page=${page}`,
        )
        for (const run of check_runs) {
          if (!(run.name in COPIED_CHECKS)) continue
          const seen = newest.get(run.name)
          if (!seen || run.id > seen.id) newest.set(run.name, run)
        }
        if (check_runs.length < 100) break
      }
      return newest
    },
    report: (body: Record<string, unknown>) =>
      json("/check-runs", { method: "POST", body: { status: "completed", ...body } }),
  }
}

/** Whether every check worth waiting for has finished on the parent. */
function settled(runs: Map<string, CheckRun>): boolean {
  return Object.entries(COPIED_CHECKS).every(([name, when]) => {
    const run = runs.get(name)
    return run ? run.status === "completed" : when === "when-present"
  })
}

export async function main(env: Env, deps: Deps): Promise<number> {
  try {
    const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))
    const parent = required(env, "PARENT_SHA")
    const head = required(env, "HEAD_SHA")
    const runUrl = required(env, "RUN_URL")
    const short = parent.slice(0, 7)

    await gh.report({
      name: "E2E tests",
      head_sha: head,
      conclusion: "success",
      details_url: runUrl,
      output: {
        title: "Snapshot-only commit",
        summary: `This run tested ${short} and wrote the screenshot baselines this commit adds. Nothing else failed.`,
      },
    })

    const deadline = deps.now() + WAIT_MS
    let runs = await gh.latest(parent)
    while (!settled(runs) && deps.now() < deadline) {
      await deps.sleep(POLL_MS)
      runs = await gh.latest(parent)
    }

    for (const [name, when] of Object.entries(COPIED_CHECKS)) {
      const run = runs.get(name)
      if (!run && when === "when-present") continue
      if (!run?.conclusion || !COPYABLE.has(run.conclusion)) {
        deps.log(
          `::warning::${name} has no finished result on ${short}` +
            (run ? ` (${run.status}, ${run.conclusion ?? "no conclusion"})` : "") +
            `, so it isn't reported on ${head.slice(0, 7)}. Approve the run waiting on that commit for its real result.`,
        )
        continue
      }
      await gh.report({
        name,
        head_sha: head,
        conclusion: run.conclusion,
        details_url: run.html_url,
        output: {
          title: `${run.conclusion} on ${short}`,
          summary: `This commit only adds screenshot baselines, so it carries ${name}'s result from ${short}: [${run.conclusion}](${run.html_url}).`,
        },
      })
      deps.log(`${name}: ${run.conclusion} (copied from ${short})`)
    }
    return 0
  } catch (err) {
    deps.log(`::error::${(err as Error).message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.env, {
    fetch: (...args) => fetch(...args),
    log: (message) => process.stdout.write(`${message}\n`),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
  })
}
