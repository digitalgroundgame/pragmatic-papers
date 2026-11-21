/**
 * Keeps one open GitHub issue per Worker while its deploy is failing, so a broken
 * staging or production Worker can't fail push after push unnoticed. Run by the last
 * job of .github/workflows/worker.yml, under plain Node 24:
 *
 *   node scripts/worker-deploy-issue.ts
 *
 * - The deploy failed: open "Worker deploy failing: <target>" (labelled `ci`), or comment
 *   on the one already open, with the commit and the run.
 * - It passed: comment on that issue and close it.
 * - Cancelled (a newer push took over): nothing.
 *
 * Reads GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_SHA, RUN_URL, TARGET (staging or
 * production) and RESULT (the deploy job's result).
 */
import { pathToFileURL } from "node:url"

export const LABEL = "ci"

export interface Config {
  repo: string
  token: string
  sha: string
  runUrl: string
  target: string
  result: string
}

export interface Deps {
  fetch: typeof fetch
  log: (message: string) => void
}

interface Issue {
  number: number
  title: string
  pull_request?: unknown
}

export const issueTitle = (target: string): string => `Worker deploy failing: ${target}`

export function readConfig(env: Record<string, string | undefined>): Config {
  const read = (name: string) => {
    const value = env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
  }
  return {
    repo: read("GITHUB_REPOSITORY"),
    token: read("GITHUB_TOKEN"),
    sha: read("GITHUB_SHA"),
    runUrl: read("RUN_URL"),
    target: read("TARGET"),
    result: read("RESULT"),
  }
}

export function failureBody(config: Config): string {
  return [
    `The ${config.target} Worker's deploy (\`.github/workflows/worker.yml\`) failed on ${config.sha.slice(0, 7)}: ${config.runUrl}`,
    "",
    "Until a deploy passes, the Worker keeps serving the last build that did. Each failed push adds a comment here, and the next deploy that passes closes this issue.",
  ].join("\n")
}

export async function main(config: Config, deps: Deps): Promise<void> {
  if (config.result !== "success" && config.result !== "failure") {
    deps.log(`The deploy was ${config.result}; nothing to report.`)
    return
  }
  const api = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const res = await deps.fetch(`https://api.github.com/repos/${config.repo}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    if (!res.ok)
      throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`)
    return res.json() as Promise<unknown>
  }

  const title = issueTitle(config.target)
  const open = (await api(`/issues?state=open&labels=${LABEL}&per_page=100`)) as Issue[]
  const issue = open.find((item) => !item.pull_request && item.title === title)
  const short = config.sha.slice(0, 7)

  if (config.result === "failure") {
    if (issue) {
      await api(`/issues/${issue.number}/comments`, {
        method: "POST",
        body: { body: `Still failing on ${short}: ${config.runUrl}` },
      })
      deps.log(`Commented on #${issue.number}.`)
    } else {
      const created = (await api("/issues", {
        method: "POST",
        body: { title, body: failureBody(config), labels: [LABEL] },
      })) as Issue
      deps.log(`Opened #${created.number}.`)
    }
    return
  }

  if (!issue) return
  await api(`/issues/${issue.number}/comments`, {
    method: "POST",
    body: { body: `Deployed again on ${short}: ${config.runUrl}` },
  })
  await api(`/issues/${issue.number}`, {
    method: "PATCH",
    body: { state: "closed", state_reason: "completed" },
  })
  deps.log(`Closed #${issue.number}.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main(readConfig(process.env), { fetch, log: console.warn })
}
