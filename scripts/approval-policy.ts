/**
 * Decides whether CI's Claude review (.github/workflows/claude-review.yml) can
 * give a PR into dev the "Review acknowledged" status on its own, from the
 * approval policy in `.claude/approvals.yml`. Run under plain Node 24 (no
 * install needed), with the policy already converted to JSON (the runner's `yq`):
 *
 *   node scripts/approval-policy.ts <policy.json> <diff.txt> <review.json> <author-type>
 *
 * `diff.txt` is `git diff --raw --no-renames <base>...<head>`, `review.json` the
 * review's structured output, and `author-type` the PR opener's GitHub user type.
 * It writes `approve=true|false` and `reason=…` to GITHUB_OUTPUT.
 *
 * The policy is a subset of Claude Ship's Claude Approvals format
 * (code.claude.com/docs/en/approvals-policy), so the same file carries over if
 * the repo moves to it:
 *
 * - `version: 1`, `mode: enforce | observe`, and `rules`, each with a `purpose`,
 *   `paths` (globs; a leading `!` excludes), a `verdict` (`claude`: approves,
 *   comments or blocks; `seats`: how many people still have to sign off) and an
 *   optional `override` list of `{ if, verdict }`. The only condition understood
 *   here is `claude/code_review = pass`: the review found no blocker and no
 *   should-fix finding. Any other key or condition makes the policy invalid,
 *   which approves nothing.
 * - Like Ship, the strictest verdict of the rules that apply to a file wins,
 *   every changed file must be covered by a rule, and Claude approves only when
 *   every rule that applies says `approves` with no seats left.
 *
 * On top of the policy, nothing is approved when a bot opened the PR (the
 * Sentry and bug fixers' drafts come from production text), when the PR changes
 * a file Ship protects (any approvals policy, REVIEW.md, CODEOWNERS,
 * .gitattributes, .gitmodules), or a symlink or submodule. In `observe` mode it
 * reports what it would do and approves nothing.
 */
import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export type ClaudeVerdict = "approves" | "comments" | "blocks"

export interface Verdict {
  claude: ClaudeVerdict
  seats: number
}

export interface Rule {
  purpose: string
  paths: string[]
  verdict: Verdict
  override?: { if: string; verdict: Verdict }[]
}

export interface Policy {
  version: 1
  mode: "enforce" | "observe"
  rules: Rule[]
}

export interface Review {
  verdict?: string
  findings?: { blocker?: number; should_fix?: number; worth_noting?: number }
}

export interface FileChange {
  path: string
  /** Git's file mode on either side: 120000 is a symlink, 160000 a submodule. */
  modes: string[]
}

export interface Decision {
  approve: boolean
  reason: string
}

const CONDITIONS = new Set(["claude/code_review = pass"])
const CLAUDE_VERDICTS: ClaudeVerdict[] = ["approves", "comments", "blocks"]
const STRICTNESS: Record<ClaudeVerdict, number> = { approves: 0, comments: 1, blocks: 2 }

/** Files Ship never lets Claude approve a change to. */
export const PROTECTED: RegExp[] = [
  /(^|\/)\.claude\/approvals\.ya?ml$/,
  /(^|\/)\.claude\/classifiers\//,
  /^REVIEW\.md$/,
  /(^|\/)CODEOWNERS$/,
  /(^|\/)\.gitattributes$/,
  /(^|\/)\.gitmodules$/,
]

/** `**` spans folders, `*` and `?` stay within one, and dotfiles match like any other. */
export function globToRegExp(glob: string): RegExp {
  let source = ""
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!
    if (char === "*" && glob[i + 1] === "*") {
      i++
      if (glob[i + 1] === "/") {
        i++
        source += "(?:.*/)?"
      } else {
        source += ".*"
      }
    } else if (char === "*") {
      source += "[^/]*"
    } else if (char === "?") {
      source += "[^/]"
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    }
  }
  return new RegExp(`^${source}$`)
}

export function matchesPaths(path: string, patterns: string[]): boolean {
  const included = patterns.some((p) => !p.startsWith("!") && globToRegExp(p).test(path))
  const excluded = patterns.some((p) => p.startsWith("!") && globToRegExp(p.slice(1)).test(path))
  return included && !excluded
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function onlyKeys(value: Record<string, unknown>, keys: string[], where: string): void {
  const extra = Object.keys(value).filter((key) => !keys.includes(key))
  if (extra.length) throw new Error(`${where}: unsupported key ${extra.join(", ")}`)
}

function parseVerdict(value: unknown, where: string): Verdict {
  if (!isRecord(value)) throw new Error(`${where}: verdict must be a map`)
  onlyKeys(value, ["claude", "seats"], where)
  const claude = value.claude ?? "comments"
  if (!CLAUDE_VERDICTS.includes(claude as ClaudeVerdict)) {
    throw new Error(`${where}: claude must be approves, comments or blocks`)
  }
  const seats = value.seats ?? 0
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 0 || seats > 16) {
    throw new Error(`${where}: seats must be a whole number from 0 to 16`)
  }
  return { claude: claude as ClaudeVerdict, seats }
}

/** Checks the policy's shape, refusing anything this subset doesn't understand. */
export function parsePolicy(value: unknown): Policy {
  if (!isRecord(value)) throw new Error("The policy must be a map")
  onlyKeys(value, ["version", "mode", "rules"], "policy")
  if (value.version !== 1) throw new Error("policy: version must be 1")
  const mode = value.mode ?? "enforce"
  if (mode !== "enforce" && mode !== "observe")
    throw new Error("policy: mode must be enforce or observe")
  if (!Array.isArray(value.rules)) throw new Error("policy: rules must be a list")
  const rules = value.rules.map((rule, index): Rule => {
    const where = `rule ${index + 1}`
    if (!isRecord(rule)) throw new Error(`${where}: must be a map`)
    onlyKeys(rule, ["purpose", "paths", "verdict", "override"], where)
    if (typeof rule.purpose !== "string" || !rule.purpose)
      throw new Error(`${where}: needs a purpose`)
    if (
      !Array.isArray(rule.paths) ||
      !rule.paths.length ||
      !rule.paths.every((p) => typeof p === "string")
    ) {
      throw new Error(`${where}: paths must be a list of globs`)
    }
    const override = (rule.override ?? []) as unknown
    if (!Array.isArray(override)) throw new Error(`${where}: override must be a list`)
    return {
      purpose: rule.purpose,
      paths: rule.paths as string[],
      verdict: parseVerdict(rule.verdict ?? {}, where),
      override: override.map((entry, i) => {
        const at = `${where}, override ${i + 1}`
        if (!isRecord(entry)) throw new Error(`${at}: must be a map`)
        onlyKeys(entry, ["if", "verdict"], at)
        if (typeof entry.if !== "string" || !CONDITIONS.has(entry.if.trim())) {
          throw new Error(`${at}: unsupported condition ${JSON.stringify(entry.if)}`)
        }
        return { if: entry.if.trim(), verdict: parseVerdict(entry.verdict, at) }
      }),
    }
  })
  return { version: 1, mode, rules }
}

/** Ship's `claude/code_review = pass`: no blocker and no should-fix finding. */
export function reviewPassed(review: Review): boolean {
  const { blocker, should_fix } = review.findings ?? {}
  return review.verdict === "pass" && blocker === 0 && should_fix === 0
}

function ruleVerdict(rule: Rule, passed: boolean): Verdict {
  const hit = rule.override?.find((entry) => entry.if === "claude/code_review = pass" && passed)
  return hit ? hit.verdict : rule.verdict
}

/** Parses `git diff --raw --no-renames`: `:100644 100644 <sha> <sha> M\t<path>`. */
export function parseRawDiff(raw: string): FileChange[] {
  return raw
    .split("\n")
    .filter((line) => line.startsWith(":"))
    .map((line) => {
      const [meta, ...rest] = line.split("\t")
      const [srcMode, dstMode] = meta!.slice(1).split(" ")
      return { path: rest.join("\t"), modes: [srcMode!, dstMode!] }
    })
}

export function decide(
  policy: Policy,
  changes: FileChange[],
  review: Review,
  authorType: string,
): Decision {
  if (authorType !== "User") return { approve: false, reason: "a bot opened this PR" }
  if (!changes.length) return { approve: false, reason: "the PR changes no files" }
  const passed = reviewPassed(review)

  for (const { path, modes } of changes) {
    if (PROTECTED.some((pattern) => pattern.test(path))) {
      return { approve: false, reason: `${path} is protected` }
    }
    if (modes.some((mode) => mode === "120000" || mode === "160000")) {
      return { approve: false, reason: `${path} is a symlink or submodule` }
    }
    const rules = policy.rules.filter((rule) => matchesPaths(path, rule.paths))
    if (!rules.length) return { approve: false, reason: `no rule covers ${path}` }
    for (const rule of rules) {
      const verdict = ruleVerdict(rule, passed)
      if (STRICTNESS[verdict.claude] > STRICTNESS.approves || verdict.seats > 0) {
        return { approve: false, reason: `${path}: ${rule.purpose}` }
      }
    }
  }
  return { approve: true, reason: "every changed file is one the policy lets Claude approve" }
}

export interface Deps {
  read: (path: string) => string
  output: (name: string, value: string) => void
  log: (message: string) => void
}

export function main(args: string[], deps: Deps): number {
  const [policyPath, diffPath, reviewPath, authorType] = args
  if (!policyPath || !diffPath || !reviewPath || !authorType) {
    deps.log(
      "Usage: node scripts/approval-policy.ts <policy.json> <diff.txt> <review.json> <author-type>",
    )
    return 1
  }
  let decision: Decision
  let mode: Policy["mode"] = "enforce"
  try {
    const policy = parsePolicy(JSON.parse(deps.read(policyPath)))
    mode = policy.mode
    const review = JSON.parse(deps.read(reviewPath) || "{}") as Review
    decision = decide(policy, parseRawDiff(deps.read(diffPath)), review, authorType)
  } catch (error) {
    decision = {
      approve: false,
      reason: `the policy can't be applied: ${(error as Error).message}`,
    }
  }
  const approve = decision.approve && mode === "enforce"
  const observed = decision.approve && !approve ? " (observe mode, so not recorded)" : ""
  deps.log(`${decision.approve ? "Approvable" : "Needs a person"}: ${decision.reason}${observed}`)
  deps.output("approve", String(approve))
  deps.output("reason", decision.reason)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2), {
    read: (path) => readFileSync(path, "utf8"),
    output: (name, value) => {
      if (process.env.GITHUB_OUTPUT)
        appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value.replace(/\n/g, " ")}\n`)
    },
    log: (message) => process.stdout.write(`${message}\n`),
  })
}
