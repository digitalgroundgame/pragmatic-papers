import { spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "../..")
const WORKFLOW = ".github/workflows/pr-events.yml"
const WAITS = "Say the Claude review waits for a draft"

const lines = () => readFileSync(join(ROOT, WORKFLOW), "utf8").split("\n")

/** The indented block under `key: <marker>` in the step named `name`. */
function stepBlock(name: string, key: "if" | "run"): string {
  const all = lines()
  const start = all.findIndex((line) => line.trim() === `- name: ${name}`)
  expect(start, `no step named "${name}" in ${WORKFLOW}`).toBeGreaterThan(-1)
  const end = all.findIndex((line, i) => i > start && line.trim().startsWith("- "))
  const keyLine = all.findIndex(
    (line, i) => i > start && (end === -1 || i < end) && line.trim().startsWith(`${key}: `),
  )
  expect(keyLine, `no ${key} in "${name}"`).toBeGreaterThan(-1)
  const indent = all[keyLine + 1]!.search(/\S/)
  const body: string[] = []
  for (const line of all.slice(keyLine + 1)) {
    if (line.trim() !== "" && line.search(/\S/) < indent) break
    body.push(line.slice(indent))
  }
  return body.join("\n").trim()
}

interface Event {
  action: string
  label?: string
  draft: boolean
  labels?: string[]
  base?: string
  sameRepo?: boolean
}

/**
 * Evaluates a step's `if:` against an event, by turning the handful of GitHub
 * expression forms this workflow uses into JavaScript.
 */
function runs(step: string, event: Event): boolean {
  const js = stepBlock(step, "if")
    .replace(/\.labels\.\*\.name/g, ".labels.map((l) => l.name)")
    // A missing property is null in an expression, not an error.
    .replace(/\.label\.name/g, ".label?.name")
  const github = {
    event: {
      action: event.action,
      label: event.label === undefined ? undefined : { name: event.label },
      pull_request: {
        draft: event.draft,
        base: { ref: event.base ?? "dev" },
        labels: (event.labels ?? []).map((name) => ({ name })),
      },
    },
  }
  const env = { SAME_REPO: String(event.sameRepo ?? true) }
  const contains = (list: unknown[], item: unknown) => list.includes(item)
  const fromJSON = (json: string) => JSON.parse(json) as unknown
  const evaluate = new Function("github", "env", "contains", "fromJSON", `return (${js})`) as (
    ...args: unknown[]
  ) => unknown
  return Boolean(evaluate(github, env, contains, fromJSON))
}

describe("pr-events.yml and the in review label", () => {
  it("says nothing when the label is added to a ready PR", () => {
    expect(runs(WAITS, { action: "labeled", label: "in review", draft: false })).toBe(false)
  })

  it("says the review waits when the label is added to a draft", () => {
    expect(runs(WAITS, { action: "labeled", label: "in review", draft: true })).toBe(true)
  })

  it("says nothing when a labelled draft is marked ready", () => {
    const event = { action: "ready_for_review", draft: false, labels: ["in review"] }
    expect(runs(WAITS, event)).toBe(false)
  })

  it("no longer starts the review itself", () => {
    expect(lines().join("\n")).not.toContain("claude-review.yml --repo")
  })

  it("says nothing on a draft's other events, or for other labels", () => {
    for (const event of [
      { action: "labeled", label: "e2e", draft: true, labels: ["in review"] },
      { action: "edited", draft: true, labels: ["in review"] },
      { action: "unlabeled", label: "in review", draft: true },
      { action: "reopened", draft: true, labels: ["in review"] },
    ]) {
      expect(runs(WAITS, event), JSON.stringify(event)).toBe(false)
    }
  })

  it("says nothing on drafts the review would never run on", () => {
    const labeled = { action: "labeled", label: "in review", draft: true }
    expect(runs(WAITS, { ...labeled, base: "main" })).toBe(false)
    expect(runs(WAITS, { ...labeled, sameRepo: false })).toBe(false)
  })

  it("comments on the PR that the review starts once it's ready", () => {
    const dir = mkdtempSync(join(tmpdir(), "pr-events-"))
    try {
      const gh = join(dir, "gh")
      writeFileSync(gh, `#!/bin/sh\nfor a in "$@"; do echo "$a"; done > "${dir}/args"\n`)
      chmodSync(gh, 0o755)
      const result = spawnSync("bash", ["-e", "-c", stepBlock(WAITS, "run")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          PR_NUMBER: "42",
          GITHUB_REPOSITORY: "owner/repo",
        },
      })
      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(join(dir, "args"), "utf8").trim().split("\n")).toEqual([
        "pr",
        "comment",
        "42",
        "--repo",
        "owner/repo",
        "--body",
        "The Claude review starts when this PR is marked ready for review.",
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
