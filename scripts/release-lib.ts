// Shared helpers for the release (scripts/release.ts) and hotfix (scripts/hotfix.ts)
// flows. Pure string builders/parsers are exported for unit testing; the
// side-effecting helpers (git/gh, prompts, polling) wrap them.

import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import * as readline from "node:readline"
import { fileURLToPath } from "node:url"

import { green, red, yellow } from "./ansi.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

// ── Pure helpers (unit-tested) ─────────────────────────────────────────────

/** A bare semantic version like `1.2.3` (no leading `v`). */
export const VERSION_RE = /^\d+\.\d+\.\d+$/

/** First positional argument that looks like a bare semver, if any. */
export function findVersion(args: string[]): string | undefined {
  return args.find((a) => VERSION_RE.test(a))
}

export interface PrRef {
  owner: string
  repo: string
  number: string
}

/** Parse owner/repo/number out of a `https://github.com/owner/repo/pull/123` URL. */
export function parsePrRef(prUrl: string): PrRef {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  const [, owner, repo, number] = match ?? []
  if (!owner || !repo || !number) throw new Error(`Cannot parse PR URL: ${prUrl}`)
  return { owner, repo, number }
}

/** jq program that collapses a PR's state into MERGED / OPEN / CLOSED. */
export const PR_STATE_JQ = 'if .merged then "MERGED" else (.state | ascii_upcase) end'

/** `gh api` command that prints a PR's collapsed state (see PR_STATE_JQ). */
export function prStateCommand(ref: PrRef): string {
  return `gh api repos/${ref.owner}/${ref.repo}/pulls/${ref.number} --jq '${PR_STATE_JQ}'`
}

/**
 * Queue an auto-merge that lands as a real **merge commit** (`--merge`), never a
 * squash, and waits for required checks (`--auto`). This is what keeps the sync
 * branches (dev↔main) from diverging.
 */
export function autoMergeCommand(prUrl: string): string {
  return `gh pr merge "${prUrl}" --auto --merge`
}

// ── Side-effecting helpers ─────────────────────────────────────────────────

export function run(cmd: string): void {
  execSync(cmd, { cwd: root, stdio: "inherit" })
}

export function capture(cmd: string): string {
  return execSync(cmd, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim()
}

/** Fail fast with a friendly message if the GitHub CLI is not installed. */
export function requireGh(): void {
  try {
    execSync("gh --version", { stdio: "ignore" })
  } catch {
    console.error(`${red("✖")} GitHub CLI (gh) is required. See: https://cli.github.com`)
    process.exit(1)
  }
}

export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function prState(prUrl: string): string {
  return capture(prStateCommand(parsePrRef(prUrl)))
}

/** Prompt the operator to merge the PR by hand, confirming it actually landed. */
export async function waitForMerge(prUrl: string): Promise<void> {
  for (;;) {
    await ask(`${yellow("?")} Press Enter once the PR has been merged: `)
    const state = prState(prUrl)
    if (state === "MERGED") {
      console.warn(`${green("✔")} PR merged`)
      return
    }
    console.warn(`${red("✖")} PR state is "${state}" — not merged yet`)
  }
}

/**
 * Enable a merge-commit auto-merge and poll until it lands. Removes the manual
 * "remember to pick merge, not squash, and don't click Update branch" footgun on
 * the dev↔main sync PRs. Falls back to a manual merge prompt if auto-merge can't
 * be enabled (e.g. the repo doesn't have it turned on).
 */
export async function autoMergeAndWait(prUrl: string, pollMs = 10_000): Promise<void> {
  try {
    run(autoMergeCommand(prUrl))
    console.warn(`${green("✔")} Auto-merge (merge commit) enabled — waiting for checks…`)
  } catch {
    console.warn(
      `${yellow("!")} Could not enable auto-merge. Merge it manually with a ` +
        `${yellow("merge commit")} (not squash), and do not click "Update branch".`,
    )
    return waitForMerge(prUrl)
  }

  for (;;) {
    const state = prState(prUrl)
    if (state === "MERGED") {
      console.warn(`${green("✔")} PR merged`)
      return
    }
    if (state === "CLOSED") {
      console.error(`${red("✖")} PR was closed without merging`)
      process.exit(1)
    }
    await sleep(pollMs)
  }
}
