// Reports the required checks on a commit that playwright.yml or
// update-snapshots.yml pushes to a PR branch. A push made with GITHUB_TOKEN
// starts runs that wait for a maintainer's approval, so without these the
// commit would have no results until someone approves them.
//
// The commit only adds screenshot baselines, so each CI check is copied from
// the commit before it (PARENT_SHA) with that commit's real conclusion: a
// failing check stays failing. A check the parent hasn't finished within
// WAIT_MS is left unreported, and the waiting run decides it once approved.
// "E2E tests" is reported as passing: the calling job tested PARENT_SHA and
// only calls this when nothing but the new baselines failed.
//
// Env: GITHUB_REPOSITORY, GITHUB_TOKEN, PARENT_SHA, HEAD_SHA, RUN_URL.

import { pathToFileURL } from "node:url"

/** ci.yml's jobs that protect-branch requires, plus Storybook. */
export const COPIED_CHECKS = ["Static checks", "Unit tests", "Integration tests", "Storybook"]

/** The GitHub Actions app, which both ci.yml's jobs and this script report as. */
export const ACTIONS_APP_ID = 15368

/** Conclusions a check run can be created with that mean the same thing on the new commit. */
const COPYABLE = new Set(["success", "failure", "neutral", "cancelled", "skipped", "timed_out"])

export const WAIT_MS = 20 * 60 * 1000
export const POLL_MS = 30 * 1000

export type Env = Record<string, string | undefined>

export interface CheckRun {
  id: number
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
    /** The newest run of a check on a commit, or undefined when it has none. */
    latest: async (sha: string, name: string) => {
      const { check_runs } = await json<{ check_runs: CheckRun[] }>(
        `/commits/${sha}/check-runs?check_name=${encodeURIComponent(name)}&app_id=${ACTIONS_APP_ID}&filter=latest&per_page=100`,
      )
      return check_runs.reduce<CheckRun | undefined>(
        (newest, run) => (!newest || run.id > newest.id ? run : newest),
        undefined,
      )
    },
    report: (body: Record<string, unknown>) =>
      json("/check-runs", { method: "POST", body: { status: "completed", ...body } }),
  }
}

/** Waits for the parent's run of `name` to finish; undefined if it doesn't in time. */
async function finished(
  gh: ReturnType<typeof github>,
  deps: Deps,
  sha: string,
  name: string,
  deadline: number,
): Promise<CheckRun | undefined> {
  for (;;) {
    const run = await gh.latest(sha, name)
    if (run?.status === "completed") return run
    if (deps.now() >= deadline) return undefined
    await deps.sleep(POLL_MS)
  }
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
    for (const name of COPIED_CHECKS) {
      const run = await finished(gh, deps, parent, name, deadline)
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
