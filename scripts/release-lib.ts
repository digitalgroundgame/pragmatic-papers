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

/**
 * Subject of the version-bump commit. Shared so a retry can recognise the commit
 * an earlier, half-finished run already made (see `prepareBranch`).
 */
export function bumpMessage(tag: string): string {
  return `Bump package.json to ${tag}`
}

/** `gh pr list` command that prints the open PR URL for `branch` → `base`, if any. */
export function prListCommand(branch: string, base: string): string {
  return `gh pr list --head ${branch} --base ${base} --state open --json url --jq '.[0].url // empty'`
}

/** jq program that collapses a PR's state into MERGED / OPEN / CLOSED. */
export const PR_STATE_JQ = 'if .merged then "MERGED" else (.state | ascii_upcase) end'

/** `gh api` command that prints a PR's collapsed state (see PR_STATE_JQ). */
export function prStateCommand(ref: PrRef): string {
  return `gh api repos/${ref.owner}/${ref.repo}/pulls/${ref.number} --jq '${PR_STATE_JQ}'`
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

/** True when a local branch of this name exists. */
export function branchExists(branch: string): boolean {
  try {
    execSync(`git rev-parse --verify --quiet refs/heads/${branch}`, { cwd: root, stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/** Subjects of the commits on `branch` that are not yet on `base`. */
export function commitSubjects(base: string, branch: string): string[] {
  return capture(`git log --format=%s ${base}..${branch}`).split("\n").filter(Boolean)
}

/** True when `git add` has staged something that is not yet committed. */
export function hasStagedChanges(): boolean {
  try {
    execSync("git diff --cached --quiet", { cwd: root, stdio: "ignore" })
    return false
  } catch {
    return true
  }
}

/**
 * Check out the release/hotfix branch, resuming one left behind by a half-finished
 * run instead of dying on `git checkout -b`. A run can fail after the branch exists
 * (rejected signing passphrase, pre-commit hook, network) and every retry used to
 * hit `fatal: a branch named ... already exists`.
 *
 * Reuse is only safe when the branch carries nothing but the version bump, so a
 * branch with unexpected commits stops the run and names the recovery options
 * rather than resetting work.
 */
export function prepareBranch(branch: string, base: string, tag: string): void {
  if (!branchExists(branch)) {
    run(`git checkout -b ${branch}`)
    return
  }

  const unexpected = commitSubjects(base, branch).filter((s) => s !== bumpMessage(tag))
  if (unexpected.length > 0) {
    console.error(`${red("✖")} Branch ${branch} exists and has commits beyond the version bump:`)
    for (const subject of unexpected) console.error(`${red("✖")}   ${subject}`)
    console.error(`${red("✖")} Finish or drop it by hand, e.g. git branch -D ${branch}`)
    process.exit(1)
  }

  console.warn(`${yellow("!")} Reusing ${branch} left by an earlier run`)
  run(`git checkout ${branch}`)
}

/** Commit staged changes, tolerating a retry where an earlier run already committed. */
export function commitIfStaged(message: string): void {
  if (!hasStagedChanges()) {
    console.warn(`${yellow("!")} Nothing staged — version bump is already committed`)
    return
  }
  run(`git commit -m "${message}"`)
}

/**
 * Open PR URL for `branch` → `base`, reusing one from an earlier run if present.
 *
 * `--fill` takes the title from the commit subject only when the branch carries a
 * single commit; with several it falls back to the head branch name, which is how the
 * dev → main release PR ended up titled "dev". Pass `title` for any branch that can
 * carry more than one commit — `--title` overrides `--fill` and still autofills the body.
 */
export function createOrReusePr(branch: string, base: string, title?: string): string {
  const existing = capture(prListCommand(branch, base))
  if (existing) {
    console.warn(`${yellow("!")} Reusing open PR for ${branch} → ${base}`)
    return existing
  }
  return capture(`gh pr create -f ${title ? `-t "${title}" ` : ""}-B ${base}`)
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
 * Wait on a dev↔main sync PR, which has to be merged by hand: these PRs are merged
 * with a ruleset bypass, and `gh pr merge --auto` cannot bypass a ruleset — it either
 * refuses outright or queues a merge that never fires, leaving the release polling
 * forever. So prompt instead, and lead with the part that actually matters.
 *
 * The merge MUST be a merge commit. A squash rewrites the commits onto the target and
 * leaves dev and main permanently diverged, which is the whole reason these PRs exist.
 */
export async function waitForSyncMerge(prUrl: string): Promise<void> {
  console.warn(
    `${yellow("!")} Merge this one with a ${yellow("merge commit")} — not a squash, ` +
      `and do not click "Update branch". A squash diverges dev from main.`,
  )
  return waitForMerge(prUrl)
}
