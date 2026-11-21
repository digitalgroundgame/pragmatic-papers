/**
 * Picks the effort level for CI's Claude review (.github/workflows/claude-review.yml)
 * from the PR's diff, run under plain Node 24 (no install needed):
 *
 *   node scripts/review-effort.ts <base-sha> <head-sha>
 *
 * It writes `effort=<level>` to GITHUB_OUTPUT, which the review passes to
 * Claude Code as `--effort`. Opus defaults to `medium` when no level is sent,
 * so without this every review ran at medium, whatever the PR.
 *
 * - The size is the lines added and removed, leaving out files nobody reads
 *   line by line (lockfiles, generated types, migration snapshots, snapshots).
 * - Up to SMALL_LINES is `medium`, up to LARGE_LINES `high`, and above that
 *   `xhigh`.
 * - A PR touching a path in SENSITIVE (CI, migrations, access rules, sign-in,
 *   the edge cache) goes up one level, so even a one-line change there gets
 *   `high`.
 *
 * `max` is left out: it rarely finds more than `xhigh` in a review and would
 * run into the review step's time limit.
 */
import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const LEVELS = ["medium", "high", "xhigh"] as const
export type Effort = (typeof LEVELS)[number]

export const SMALL_LINES = 50
export const LARGE_LINES = 600

/** Files whose lines don't count toward the size. */
export const GENERATED: RegExp[] = [
  /(^|\/)pnpm-lock\.yaml$/,
  /^src\/payload-types\.ts$/,
  /^src\/migrations\/.*\.json$/,
  /^src\/app\/\(payload\)\/admin\/importMap\.js$/,
  /\.snap$/,
]

/** Paths where a mistake is costly or hard to see, so the review digs deeper. */
export const SENSITIVE: RegExp[] = [
  /^\.github\/workflows\//,
  /^src\/migrations\//,
  /^src\/access\//,
  /^src\/plugins\/sso\//,
  /^src\/plugins\/comments\//,
  /^src\/hooks\/purgeEdgeCache\.ts$/,
  /^src\/cloudflare\//,
  /^cloudflare\//,
  /^dockerfiles\//,
  /^src\/payload\.config\.ts$/,
  /^next\.config\.ts$/,
]

export interface FileChange {
  path: string
  /** Lines added plus removed; binary files count 0. */
  lines: number
}

/** `src/{a => b}/x.ts` → `src/b/x.ts`; `a.ts => b.ts` → `b.ts`. */
function renamedTo(path: string): string {
  const braces = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/)
  if (braces) return `${braces[1]}${braces[3]}${braces[4]}`.replace(/\/\//g, "/")
  const plain = path.split(" => ")
  return plain[plain.length - 1]!
}

/** Parses `git diff --numstat` output. Renames come as `old => new`; the new path counts. */
export function parseNumstat(numstat: string): FileChange[] {
  return numstat
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [added, removed, ...rest] = line.split("\t")
      const path = renamedTo(rest.join("\t"))
      const lines = (Number(added) || 0) + (Number(removed) || 0)
      return { path, lines }
    })
}

export function pickEffort(changes: FileChange[]): Effort {
  const size = changes
    .filter(({ path }) => !GENERATED.some((pattern) => pattern.test(path)))
    .reduce((total, { lines }) => total + lines, 0)
  let level = size <= SMALL_LINES ? 0 : size <= LARGE_LINES ? 1 : 2
  if (changes.some(({ path }) => SENSITIVE.some((pattern) => pattern.test(path)))) level += 1
  return LEVELS[Math.min(level, LEVELS.length - 1)]!
}

export interface Deps {
  numstat: (base: string, head: string) => string
  output: (name: string, value: string) => void
  log: (message: string) => void
}

export function main(args: string[], deps: Deps): number {
  const [base, head] = args
  if (!base || !head) {
    deps.log("Usage: node scripts/review-effort.ts <base-sha> <head-sha>")
    return 1
  }
  const changes = parseNumstat(deps.numstat(base, head))
  const effort = pickEffort(changes)
  deps.log(`${changes.length} files changed; reviewing at ${effort} effort`)
  deps.output("effort", effort)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2), {
    // Three dots: what the PR changes since it left the base, not what the
    // base changed since.
    numstat: (base, head) =>
      execFileSync("git", ["diff", "--numstat", `${base}...${head}`], { encoding: "utf8" }),
    output: (name, value) => {
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
    },
    log: (message) => process.stdout.write(`${message}\n`),
  })
}
