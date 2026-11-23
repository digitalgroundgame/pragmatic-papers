/**
 * Turns Sentry errors into GitHub issues, and those issues, and the team's own bug reports,
 * into draft PRs for a person to review. Run under plain Node 24 (no install needed) by two workflows:
 *
 *   node scripts/sentry-fix.ts intake   # .github/workflows/sentry-intake.yml, hourly
 *   node scripts/sentry-fix.ts gate     # .github/workflows/sentry-fix.yml, before Claude
 *   node scripts/sentry-fix.ts report   # .github/workflows/sentry-fix.yml, after Claude
 *
 * - **intake** asks Sentry for the unresolved issues matching SENTRY_QUERY in
 *   SENTRY_ENVIRONMENTS, drops those .github/sentry-filter.json keeps out (filterIssue), and
 *   files a GitHub issue (label `sentry`) for each one no issue
 *   names yet, in any state: an issue a person closed as not planned stays closed. It also
 *   queues the open issues `eligibleIssue` accepts (the team's unassigned bugs) that Claude
 *   hasn't tried before. It then lists, for the workflow to dispatch, the new Sentry issues
 *   and any left `claude queued`, oldest first, as many as today's budget has room for.
 * - **gate** decides whether Claude works on an issue now. Not when it's closed, an open
 *   PR already names it, or it's neither from Sentry nor accepted by `eligibleIssue`. A person adding the `fix with claude` label (FORCE) always gets a
 *   run; otherwise SENTRY_FIX_AUTO=false or a spent budget stops it, and a spent budget
 *   labels it `claude queued` for the next day's room. A run starts with a comment carrying
 *   ATTEMPT_MARKER, which is what the budget counts.
 * - **report** rewrites that comment with Claude's verdict, retitles the issue to Claude's
 *   short description, and labels a duplicate.
 *
 * Sentry's own GitHub integration can file the issues instead (an alert rule's "Create a
 * new GitHub issue", Business plan and up); those come from `sentry[bot]`, start with the
 * same `Sentry Issue: [SHORT-ID](link)` line this writes, and go through the same gate.
 */
import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const ATTEMPT_MARKER = "<!-- sentry-fix:attempt -->"
export const LABELS = { sentry: "sentry", queued: "claude queued", force: "fix with claude" }
export const DEFAULTS = {
  org: "digital-ground-game",
  project: "pragmatic-papers",
  // Errors (not performance issues) seen at least 3 times, still happening, and not yet
  // linked to a GitHub issue. One-off infrastructure blips (a DNS hiccup, one dropped
  // connection) stay below the count; they don't get code workarounds.
  query: "is:unresolved is:unlinked issue.category:error timesSeen:>=3 lastSeen:-24h",
  environments: "production,staging",
  dailyLimit: 3,
  intakeLimit: 5,
  issueTypes: "Bug",
}
/**
 * Labels that keep an issue from Claude unless a person adds `fix with claude`: it waits on
 * people, isn't a bug to fix, or (security) shouldn't get a public draft PR.
 */
export const HOLD_LABELS = [
  "blocked",
  "discussion",
  "question",
  "waiting on design",
  "security",
  "wontfix",
  "invalid",
  "duplicate",
  "in progress",
  "stale",
]
/** Who an issue's author must be for its text to steer Claude: people with access to the repository. */
const TEAM = new Set(["OWNER", "MEMBER", "COLLABORATOR"])
/** Open issues intake reads per run when looking for ones to queue. */
const ISSUE_PAGES = 3
const DAY_MS = 24 * 60 * 60 * 1000
const TITLE_MAX = 100
const MESSAGE_MAX = 500
const FRAMES_MAX = 12
/** Pages of Sentry issues a run reads at most: errors already filed or kept out stay in the query. */
const SENTRY_PAGES = 8

// --- Sentry ------------------------------------------------------------------------------

export interface SentryIssue {
  id: string
  shortId: string
  title: string
  culprit?: string | null
  permalink: string
  level?: string
  count?: string | number
  userCount?: number
  firstSeen?: string
  lastSeen?: string
  annotations?: (string | { displayName?: string; url?: string })[]
}

interface SentryFrame {
  filename?: string | null
  absPath?: string | null
  function?: string | null
  lineNo?: number | null
  inApp?: boolean
}

export interface SentryEvent {
  tags?: { key: string; value: string }[]
  entries?: {
    type: string
    data?: {
      values?: {
        type?: string | null
        value?: string | null
        stacktrace?: { frames?: SentryFrame[] | null } | null
      }[]
    }
  }[]
}

function exceptionsOf(event: SentryEvent | null) {
  return (event?.entries ?? [])
    .filter((entry) => entry.type === "exception")
    .flatMap((entry) => entry.data?.values ?? [])
}

/** True when Sentry already links the issue to one in `repo` (its annotations). */
export function linkedToRepo(issue: SentryIssue, repo: string): boolean {
  const prefix = `github.com/${repo}/issues/`.toLowerCase()
  return (issue.annotations ?? []).some((annotation) => {
    const text = typeof annotation === "string" ? annotation : (annotation.url ?? "")
    return text.toLowerCase().includes(prefix)
  })
}

/** Sentry's title, on one line and short: Drizzle's "Failed query: <whole SQL>" runs on. */
export function issueTitle(issue: SentryIssue): string {
  const title = issue.title.replace(/\s+/g, " ").trim() || issue.shortId
  return title.length <= TITLE_MAX ? title : `${title.slice(0, TITLE_MAX - 1).trimEnd()}…`
}

/** A fenced block that the text inside can't close. */
export function fence(text: string, info = ""): string {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map(([run]) => run.length))
  const ticks = "`".repeat(longest + 1)
  return `${ticks}${info}\n${text}\n${ticks}`
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

/**
 * The issue's body: Sentry's link line first (the same one Sentry's integration writes,
 * so either finds the other), then the counts and the latest event's exception. Every
 * value from the event is in a fence: error messages carry whatever a request sent.
 */
export function issueBody(issue: SentryIssue, event: SentryEvent | null): string {
  const lines = [`Sentry Issue: [${issue.shortId}](${issue.permalink})`, ""]
  lines.push(
    "| Events | Users | First seen | Last seen | Level |",
    "| --- | --- | --- | --- | --- |",
  )
  lines.push(
    `| ${issue.count ?? "?"} | ${issue.userCount ?? "?"} | ${issue.firstSeen ?? "?"} | ${issue.lastSeen ?? "?"} | ${issue.level ?? "?"} |`,
    "",
  )
  const tags = Object.fromEntries((event?.tags ?? []).map(({ key, value }) => [key, value]))
  const context = ["environment", "release", "url", "transaction", "browser", "runtime"]
    .filter((key) => tags[key])
    .map((key) => `${key}: ${clip(String(tags[key]), 200)}`)
  if (issue.culprit) context.unshift(`culprit: ${clip(issue.culprit, 200)}`)
  if (context.length) lines.push("**Context**", "", fence(context.join("\n")), "")

  const exceptions = exceptionsOf(event)
  for (const exception of exceptions) {
    const head = [exception.type, exception.value].filter(Boolean).join(": ")
    const frames = (exception.stacktrace?.frames ?? []).filter((frame) => frame.inApp)
    // Sentry lists frames oldest first; the throw is the last one.
    const shown = frames.slice(-FRAMES_MAX).reverse()
    const trace = shown.map(
      (frame) =>
        `  at ${frame.function || "<anonymous>"} (${frame.filename || frame.absPath || "?"}:${frame.lineNo ?? "?"})`,
    )
    lines.push("**Exception**", "", fence([clip(head, MESSAGE_MAX), ...trace].join("\n")), "")
  }
  if (!exceptions.length)
    lines.push("_The latest event has no exception; see Sentry for details._", "")
  lines.push(
    "<sub>Filed by `.github/workflows/sentry-intake.yml`. Values in the blocks come from the event as Sentry received it.</sub>",
  )
  return lines.join("\n")
}

// --- Filter ------------------------------------------------------------------------------

export const FILTER_FIELDS = ["title", "culprit", "type", "message", "url", "transaction"] as const
type FilterField = (typeof FILTER_FIELDS)[number]
export type FilterRule = Partial<Record<FilterField, string>> & { reason?: string }

/** `.github/sentry-filter.json`: which errors intake files. */
export interface SentryFilter {
  /** Sentry levels to file; empty or missing files every level. */
  levels?: string[]
  /** File only errors whose latest event has a frame in our code. */
  requireInAppFrame?: boolean
  /** When there are any, an error must match one. */
  include?: FilterRule[]
  exclude?: FilterRule[]
}

export const FILTER_PATH = ".github/sentry-filter.json"

/** The values rules match against, from the issue and its latest event. */
export function filterFields(
  issue: SentryIssue,
  event: SentryEvent | null,
): Record<FilterField, string> {
  const tags = Object.fromEntries((event?.tags ?? []).map(({ key, value }) => [key, value]))
  const exceptions = exceptionsOf(event)
  return {
    title: issue.title,
    culprit: issue.culprit ?? "",
    type: exceptions.map((exception) => exception.type ?? "").join("\n"),
    // The title too: Sentry often puts the message there when the event has no exception.
    message: [issue.title, ...exceptions.map((exception) => exception.value ?? "")].join("\n"),
    url: String(tags.url ?? ""),
    transaction: String(tags.transaction ?? ""),
  }
}

function ruleMatches(rule: FilterRule, fields: Record<FilterField, string>): boolean {
  const named = FILTER_FIELDS.filter((field) => typeof rule[field] === "string")
  return (
    named.length > 0 && named.every((field) => new RegExp(rule[field]!, "i").test(fields[field]))
  )
}

/** Why an error stays out of the pipeline, or null to file it. */
export function filterIssue(
  issue: SentryIssue,
  event: SentryEvent | null,
  filter: SentryFilter,
): string | null {
  if (filter.levels?.length && !filter.levels.includes(issue.level ?? "")) {
    return `level ${issue.level ?? "unknown"} isn't one of ${filter.levels.join(", ")}`
  }
  if (filter.requireInAppFrame) {
    const inApp = exceptionsOf(event).some((exception) =>
      (exception.stacktrace?.frames ?? []).some((frame) => frame.inApp),
    )
    if (!inApp) return "no frame in our code"
  }
  const fields = filterFields(issue, event)
  if (filter.include?.length && !filter.include.some((rule) => ruleMatches(rule, fields))) {
    return "matches no include rule"
  }
  const excluded = filter.exclude?.find((rule) => ruleMatches(rule, fields))
  if (excluded) return `excluded: ${excluded.reason ?? "a rule in the filter"}`
  return null
}

/** Parses the filter file; a broken one stops intake rather than filing everything. */
export function parseFilter(text: string): SentryFilter {
  const value = JSON.parse(text) as SentryFilter
  for (const rule of [...(value.include ?? []), ...(value.exclude ?? [])]) {
    for (const field of FILTER_FIELDS) if (rule[field] !== undefined) new RegExp(rule[field]!, "i")
  }
  return value
}

/** The cursor of the next page in Sentry's `Link` header, or null on the last page. */
export function nextCursor(link: string | null): string | null {
  for (const part of (link ?? "").split(",")) {
    if (/rel="next"/.test(part) && /results="true"/.test(part)) {
      return part.match(/cursor="([^"]+)"/)?.[1] ?? null
    }
  }
  return null
}

/** The Sentry short IDs an issue body links, from its `Sentry Issue: [ID](...)` line. */
export function sentryShortIds(body: string | null | undefined): string[] {
  return [...(body ?? "").matchAll(/Sentry Issue: \[([A-Z0-9][A-Z0-9-]*)\]/g)].map(([, id]) => id!)
}

// --- Budget ------------------------------------------------------------------------------

export interface Comment {
  created_at: string
  body?: string | null
  user?: { login?: string } | null
}

/** Runs started in the last day: the workflow's own comments that carry the marker. */
export function attemptsSince(comments: Comment[], now: Date): number {
  const since = now.getTime() - DAY_MS
  return comments.filter(
    (comment) =>
      comment.user?.login === "github-actions[bot]" &&
      comment.body?.includes(ATTEMPT_MARKER) &&
      Date.parse(comment.created_at) >= since,
  ).length
}

export function readLimit(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

// --- Claude's verdict ---------------------------------------------------------------------

export interface Verdict {
  decision: "fix" | "noise" | "duplicate" | "needs-info"
  issue_title: string
  summary: string
  duplicate_of?: number
  pr_title?: string
  pr_body?: string
}

const CONVENTIONAL = /^(fix|perf|refactor|chore|test|feat|docs|build|ci)(\([\w./-]+\))?!?: \S/

/** A conventional-commit title (the release train versions from it), one line, ≤ 72. */
export function prTitle(verdict: Verdict, issue: number): string {
  let title = (verdict.pr_title ?? "").replace(/\s+/g, " ").trim()
  if (!title) title = `fix: ${verdict.issue_title || `Sentry issue #${issue}`}`
  if (!CONVENTIONAL.test(title)) title = `fix: ${title}`
  return clip(title, 72)
}

/** The PR's body: what Claude wrote, under the line that closes the issue. */
export function prBody(verdict: Verdict, issue: number, runUrl: string): string {
  const body = (verdict.pr_body ?? verdict.summary).trim()
  return [
    `Closes #${issue}`,
    "",
    body,
    "",
    `<sub>Drafted from a Sentry error by [this run](${runUrl}). Read it before marking it ready.</sub>`,
    "",
    "---",
    "_Generated by [Claude Code](https://claude.ai/code)_",
  ].join("\n")
}

const HEADLINES: Record<Verdict["decision"], string> = {
  fix: "Claude drafted a fix.",
  noise:
    "Claude thinks this is noise, not a bug in our code: close it as not planned if you agree.",
  duplicate: "Claude thinks this is a duplicate.",
  "needs-info": "Claude couldn't find the cause from what Sentry has.",
}

export interface Outcome {
  verdict: Verdict | null
  fixResult: string
  prUrl?: string
  publishError?: string
  runUrl: string
}

/** The run's comment on the issue, once it's done. Keeps the marker the budget counts. */
export function reportComment({
  verdict,
  fixResult,
  prUrl,
  publishError,
  runUrl,
}: Outcome): string {
  const lines: string[] = [ATTEMPT_MARKER]
  if (!verdict) {
    lines.push(
      `Claude's run ended without a verdict (${fixResult || "unknown"}). [Logs](${runUrl}). Add the \`${LABELS.force}\` label to try again.`,
    )
  } else {
    let headline = HEADLINES[verdict.decision]
    if (verdict.decision === "duplicate" && verdict.duplicate_of) {
      headline = `Claude thinks this is a duplicate of #${verdict.duplicate_of}.`
    }
    if (verdict.decision === "fix") {
      headline = prUrl
        ? `Claude drafted a fix: ${prUrl}`
        : "Claude meant to draft a fix, but no PR was opened."
    }
    lines.push(`**${headline}**`, "", verdict.summary.trim())
    if (publishError) lines.push("", `> ${publishError}`)
    lines.push("", `<sub>[Run](${runUrl})</sub>`)
  }
  lines.push("", "---", "_Generated by [Claude Code](https://claude.ai/code)_")
  return lines.join("\n")
}

export function parseVerdict(text: string | undefined): Verdict | null {
  if (!text?.trim()) return null
  try {
    const value = JSON.parse(text) as Partial<Verdict>
    if (!value || !value.decision || !(value.decision in HEADLINES)) return null
    return {
      decision: value.decision,
      issue_title: String(value.issue_title ?? ""),
      summary: String(value.summary ?? ""),
      duplicate_of: Number.isInteger(value.duplicate_of) ? value.duplicate_of : undefined,
      pr_title: value.pr_title ? String(value.pr_title) : undefined,
      pr_body: value.pr_body ? String(value.pr_body) : undefined,
    }
  } catch {
    return null
  }
}

// --- Commands ----------------------------------------------------------------------------

export interface GitHubIssue {
  number: number
  state: string
  title: string
  body?: string | null
  created_at: string
  labels?: { name: string }[]
  pull_request?: unknown
  assignees?: unknown[] | null
  author_association?: string
  type?: { name: string } | null
}

/** Whether an issue came from Sentry: its label, or the integration's link line. */
export function fromSentry(issue: GitHubIssue): boolean {
  return (
    (issue.labels ?? []).some((l) => l.name === LABELS.sentry) ||
    sentryShortIds(issue.body).length > 0
  )
}

/**
 * Why Claude shouldn't pick up an issue that isn't from Sentry on its own, or null when it
 * may: an open issue of one of `types` (ISSUE_FIX_TYPES, default Bug), written by someone
 * with access to the repository (anyone can file an issue on a public one, and its text
 * is Claude's instructions), with no assignee (assigning yourself keeps Claude off it) and
 * none of HOLD_LABELS.
 */
export function eligibleIssue(issue: GitHubIssue, types: string[]): string | null {
  if (issue.pull_request) return "it's a pull request"
  if (issue.state !== "open") return "it's closed"
  if (!issue.type?.name || !types.includes(issue.type.name)) {
    return `its type (${issue.type?.name ?? "none"}) isn't ${types.join(" or ")}`
  }
  if (!TEAM.has(issue.author_association ?? "")) return "its author isn't on the team"
  if (issue.assignees?.length) return "someone is assigned"
  const hold = (issue.labels ?? []).find((l) => HOLD_LABELS.includes(l.name))
  if (hold) return `it's labeled ${hold.name}`
  return null
}

export function issueTypes(value: string | undefined): string[] {
  return (value || DEFAULTS.issueTypes)
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean)
}

export interface Deps {
  env: Record<string, string | undefined>
  fetch: typeof fetch
  now: () => Date
  output: (name: string, value: string) => void
  log: (message: string) => void
  readFile: (path: string) => string
}

class Http {
  private deps: Deps

  constructor(deps: Deps) {
    this.deps = deps
  }

  async response(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.deps.fetch(url, init)
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(
        `${init.method ?? "GET"} ${url.split("?")[0]} → ${response.status} ${clip(text, 300)}`,
      )
    }
    return response
  }

  async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await this.response(url, init)
    return (response.status === 204 ? null : await response.json()) as T
  }

  sentry<T>(path: string): Promise<T> {
    return this.json<T>(`https://sentry.io/api/0${path}`, this.sentryInit())
  }

  /** One page of a Sentry list, and the cursor of the next when there is one. */
  async sentryPage<T>(path: string): Promise<{ items: T[]; next: string | null }> {
    const response = await this.response(`https://sentry.io/api/0${path}`, this.sentryInit())
    return { items: (await response.json()) as T[], next: nextCursor(response.headers.get("link")) }
  }

  private sentryInit(): RequestInit {
    return { headers: { Authorization: `Bearer ${this.deps.env.SENTRY_AUTH_TOKEN}` } }
  }

  github<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.json<T>(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.deps.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
}

async function recentComments(http: Http, repo: string, now: Date): Promise<Comment[]> {
  const since = new Date(now.getTime() - DAY_MS).toISOString()
  const comments: Comment[] = []
  for (let page = 1; page <= 5; page++) {
    const batch = await http.github<Comment[]>(
      "GET",
      `/repos/${repo}/issues/comments?since=${since}&per_page=100&page=${page}`,
    )
    comments.push(...batch)
    if (batch.length < 100) break
  }
  return comments
}

async function remaining(http: Http, deps: Deps, repo: string): Promise<number> {
  const limit = readLimit(deps.env.SENTRY_FIX_DAILY_LIMIT, DEFAULTS.dailyLimit)
  const used = attemptsSince(await recentComments(http, repo, deps.now()), deps.now())
  deps.log(`Budget: ${used} of ${limit} runs used in the last 24 hours.`)
  return Math.max(0, limit - used)
}

/**
 * Every Sentry short ID an issue in `repo` links, any state, with the issue: one search
 * a run rather than one per error, which the search API's rate limit wouldn't allow.
 */
async function filedShortIds(http: Http, repo: string): Promise<Map<string, number>> {
  const q = encodeURIComponent(`repo:${repo} is:issue "Sentry Issue" in:body`)
  const filed = new Map<string, number>()
  for (let page = 1; page <= 10; page++) {
    const result = await http.github<{ items: GitHubIssue[] }>(
      "GET",
      `/search/issues?q=${q}&per_page=100&page=${page}`,
    )
    for (const issue of result.items) {
      for (const id of sentryShortIds(issue.body)) filed.set(id, issue.number)
    }
    if (result.items.length < 100) break
  }
  return filed
}

/** Files a GitHub issue for each Sentry error that passes the filter, up to `intakeLimit`. */
async function fileSentryIssues(http: Http, deps: Deps, intakeLimit: number): Promise<number[]> {
  const { env } = deps
  const repo = env.GITHUB_REPOSITORY!
  const org = env.SENTRY_ORG || DEFAULTS.org
  const projectSlug = env.SENTRY_PROJECT || DEFAULTS.project
  const project = await http.sentry<{ id: string }>(`/projects/${org}/${projectSlug}/`)
  const params = new URLSearchParams({
    project: project.id,
    query: env.SENTRY_QUERY || DEFAULTS.query,
    sort: "freq",
    statsPeriod: "14d",
    limit: "25",
  })
  for (const environment of (env.SENTRY_ENVIRONMENTS || DEFAULTS.environments).split(",")) {
    if (environment.trim()) params.append("environment", environment.trim())
  }
  const filter = parseFilter(deps.readFile(env.SENTRY_FILTER_FILE || FILTER_PATH))
  const already = await filedShortIds(http, repo)
  const filed: number[] = []
  let read = 0
  const consider = async (issue: SentryIssue): Promise<number | null> => {
    if (linkedToRepo(issue, repo)) return null
    if (already.has(issue.shortId)) {
      deps.log(`${issue.shortId} is already #${already.get(issue.shortId)}.`)
      return null
    }
    const event = await http
      .sentry<SentryEvent>(`/organizations/${org}/issues/${issue.id}/events/recommended/`)
      .catch((error: Error) => {
        deps.log(`No event for ${issue.shortId}: ${error.message}`)
        return null
      })
    const skip = filterIssue(issue, event, filter)
    if (skip) {
      deps.log(`${issue.shortId} stays out: ${skip}.`)
      return null
    }
    if (env.DRY_RUN === "true") {
      deps.log(`Would file ${issue.shortId}: ${issueTitle(issue)}`)
      return null
    }
    const created = await http.github<GitHubIssue>("POST", `/repos/${repo}/issues`, {
      title: issueTitle(issue),
      body: issueBody(issue, event),
      labels: [LABELS.sentry],
    })
    deps.log(`Filed ${issue.shortId} as #${created.number}.`)
    return created.number
  }

  // Errors already filed or kept out keep matching the query, so read on past them,
  // a page at a time, until this run has filed its share.
  for (let page = 0, cursor: string | null = ""; page < SENTRY_PAGES && cursor !== null; page++) {
    if (cursor) params.set("cursor", cursor)
    const { items, next } = await http.sentryPage<SentryIssue>(
      `/organizations/${org}/issues/?${params}`,
    )
    cursor = next
    read += items.length
    for (const issue of items) {
      if (filed.length >= intakeLimit) break
      const number = await consider(issue)
      if (number) filed.push(number)
    }
    if (filed.length >= intakeLimit) {
      deps.log(`Filed ${intakeLimit} this run; the rest wait for the next.`)
      break
    }
  }
  deps.log(`Read ${read} Sentry issues matching the query.`)
  return filed
}

/** The issue numbers open PRs name in their descriptions (`Closes #12`). */
async function namedByOpenPRs(http: Http, repo: string): Promise<Set<number>> {
  const named = new Set<number>()
  for (let page = 1; page <= ISSUE_PAGES; page++) {
    const batch = await http.github<{ body?: string | null }[]>(
      "GET",
      `/repos/${repo}/pulls?state=open&per_page=100&page=${page}`,
    )
    for (const pull of batch) {
      for (const match of (pull.body ?? "").matchAll(/#(\d+)(?!\d)/g)) named.add(Number(match[1]))
    }
    if (batch.length < 100) break
  }
  return named
}

/**
 * Open issues `eligibleIssue` accepts that Claude hasn't tried (no ATTEMPT_MARKER comment),
 * that aren't queued yet and that no open PR names, oldest first, up to `limit`.
 */
async function eligibleIssues(http: Http, deps: Deps, limit: number): Promise<number[]> {
  const repo = deps.env.GITHUB_REPOSITORY!
  const types = issueTypes(deps.env.ISSUE_FIX_TYPES)
  const found: number[] = []
  let named: Set<number> | undefined
  for (let page = 1; page <= ISSUE_PAGES && found.length < limit; page++) {
    const batch = await http.github<GitHubIssue[]>(
      "GET",
      `/repos/${repo}/issues?state=open&assignee=none&sort=created&direction=asc&per_page=100&page=${page}`,
    )
    for (const issue of batch) {
      if (found.length >= limit) break
      if (fromSentry(issue) || issue.labels?.some((l) => l.name === LABELS.queued)) continue
      if (eligibleIssue(issue, types)) continue
      // The gate would skip it, and with no attempt marker it would be queued again next hour.
      named ??= await namedByOpenPRs(http, repo)
      if (named.has(issue.number)) continue
      const comments = await http.github<Comment[]>(
        "GET",
        `/repos/${repo}/issues/${issue.number}/comments?per_page=100`,
      )
      if (comments.some((c) => c.body?.includes(ATTEMPT_MARKER))) continue
      found.push(issue.number)
    }
    if (batch.length < 100) break
  }
  return found
}

export async function intake(deps: Deps): Promise<number> {
  const { env } = deps
  const repo = env.GITHUB_REPOSITORY!
  const http = new Http(deps)
  const intakeLimit = readLimit(env.SENTRY_INTAKE_LIMIT, DEFAULTS.intakeLimit)
  const filed = env.SENTRY_AUTH_TOKEN ? await fileSentryIssues(http, deps, intakeLimit) : []
  if (!env.SENTRY_AUTH_TOKEN) deps.log("SENTRY_AUTH_TOKEN isn't set; Sentry isn't read.")

  if (env.ISSUE_FIX_AUTO === "false") {
    deps.log("ISSUE_FIX_AUTO is false: only Sentry issues and labeled ones get Claude.")
  } else {
    for (const number of await eligibleIssues(http, deps, intakeLimit)) {
      if (env.DRY_RUN === "true") {
        deps.log(`Would queue #${number} for Claude.`)
        continue
      }
      await http.github("POST", `/repos/${repo}/issues/${number}/labels`, {
        labels: [LABELS.queued],
      })
      deps.log(`Queued #${number} for Claude.`)
    }
  }

  let dispatch: number[] = []
  if (env.SENTRY_FIX_AUTO === "false") {
    deps.log("SENTRY_FIX_AUTO is false: Claude starts only on the label.")
  } else if (env.DRY_RUN !== "true") {
    const queued = await http.github<GitHubIssue[]>(
      "GET",
      `/repos/${repo}/issues?state=open&labels=${encodeURIComponent(LABELS.queued)}&sort=created&direction=asc&per_page=50`,
    )
    const candidates = [...queued.filter((i) => !i.pull_request).map((i) => i.number), ...filed]
    dispatch = [...new Set(candidates)].slice(0, await remaining(http, deps, repo))
    // What the budget has no room for today waits in the queue, which the next runs read.
    for (const number of filed.filter((n) => !dispatch.includes(n))) {
      await http.github("POST", `/repos/${repo}/issues/${number}/labels`, {
        labels: [LABELS.queued],
      })
    }
  }
  deps.output("dispatch", JSON.stringify(dispatch))
  return 0
}

export async function gate(deps: Deps): Promise<number> {
  const { env } = deps
  const repo = env.GITHUB_REPOSITORY!
  const number = Number(env.ISSUE)
  const http = new Http(deps)
  const skip = (reason: string) => {
    deps.log(reason)
    deps.output("run", "false")
    return 0
  }
  if (!Number.isInteger(number) || number <= 0) return skip(`No issue number (${env.ISSUE}).`)
  const issue = await http.github<GitHubIssue>("GET", `/repos/${repo}/issues/${number}`)
  if (issue.pull_request) return skip(`#${number} is a pull request.`)
  if (issue.state !== "open") return skip(`#${number} is closed.`)
  const labels = new Set((issue.labels ?? []).map((label) => label.name))
  // A skip that won't change on its own takes the issue out of the queue, or intake would
  // dispatch it every hour ahead of the issues behind it. Intake queues it again if it
  // becomes eligible, since it has no attempt marker.
  const leaveQueue = async (reason: string) => {
    if (labels.has(LABELS.queued)) {
      await http.github(
        "DELETE",
        `/repos/${repo}/issues/${number}/labels/${encodeURIComponent(LABELS.queued)}`,
      )
    }
    return skip(reason)
  }
  const sentry = fromSentry(issue)
  if (!sentry && env.FORCE !== "true") {
    const reason = eligibleIssue(issue, issueTypes(env.ISSUE_FIX_TYPES))
    if (reason) return leaveQueue(`#${number} isn't from Sentry, and ${reason}.`)
    if (env.ISSUE_FIX_AUTO === "false")
      return leaveQueue("ISSUE_FIX_AUTO is false: waiting for the label.")
  }

  const q = encodeURIComponent(`repo:${repo} is:pr is:open "#${number}" in:body`)
  const prs = await http.github<{ items: { number: number; body?: string | null }[] }>(
    "GET",
    `/search/issues?q=${q}&per_page=20`,
  )
  const naming = prs.items.filter((item) => new RegExp(`#${number}(?!\\d)`).test(item.body ?? ""))
  if (naming.length) return leaveQueue(`#${number} already has an open PR: #${naming[0]!.number}.`)

  if (env.FORCE !== "true") {
    if (env.SENTRY_FIX_AUTO === "false")
      return skip("SENTRY_FIX_AUTO is false: waiting for the label.")
    if ((await remaining(http, deps, repo)) <= 0) {
      if (!labels.has(LABELS.queued)) {
        await http.github("POST", `/repos/${repo}/issues/${number}/labels`, {
          labels: [LABELS.queued],
        })
      }
      return skip(`Today's budget is spent; #${number} is queued.`)
    }
  }

  if (sentry && !labels.has(LABELS.sentry)) {
    await http.github("POST", `/repos/${repo}/issues/${number}/labels`, { labels: [LABELS.sentry] })
  }
  for (const label of [LABELS.queued, LABELS.force]) {
    if (labels.has(label)) {
      await http.github(
        "DELETE",
        `/repos/${repo}/issues/${number}/labels/${encodeURIComponent(label)}`,
      )
    }
  }
  const comment = await http.github<{ id: number }>(
    "POST",
    `/repos/${repo}/issues/${number}/comments`,
    {
      body: `${ATTEMPT_MARKER}\nClaude is looking into this ([run](${env.RUN_URL})). It will update this comment with what it finds, and open a draft PR if it can fix it.\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_`,
    },
  )
  deps.output("run", "true")
  deps.output("sentry", String(sentry))
  deps.output("comment_id", String(comment.id))
  return 0
}

export async function report(deps: Deps): Promise<number> {
  const { env } = deps
  const repo = env.GITHUB_REPOSITORY!
  const number = Number(env.ISSUE)
  const http = new Http(deps)
  const verdict = parseVerdict(env.VERDICT_FILE ? deps.readFile(env.VERDICT_FILE) : undefined)
  const body = reportComment({
    verdict,
    fixResult: env.FIX_RESULT ?? "",
    prUrl: env.PR_URL || undefined,
    publishError: env.PUBLISH_ERROR || undefined,
    runUrl: env.RUN_URL ?? "",
  })
  await http.github("PATCH", `/repos/${repo}/issues/comments/${env.COMMENT_ID}`, { body })
  if (verdict?.issue_title.trim()) {
    await http.github("PATCH", `/repos/${repo}/issues/${number}`, {
      title: clip(verdict.issue_title.replace(/\s+/g, " ").trim(), TITLE_MAX),
    })
  }
  if (verdict?.decision === "duplicate") {
    await http.github("POST", `/repos/${repo}/issues/${number}/labels`, { labels: ["duplicate"] })
  }
  deps.log(`Reported ${verdict?.decision ?? "no verdict"} on #${number}.`)
  return 0
}

/** For the publish step: the PR's title and body, written to files. */
export function pr(deps: Deps): number {
  const verdict = parseVerdict(deps.readFile(deps.env.VERDICT_FILE!))
  if (verdict?.decision !== "fix") {
    deps.output("open", "false")
    return 0
  }
  const issue = Number(deps.env.ISSUE)
  deps.output("open", "true")
  deps.output("title", prTitle(verdict, issue))
  deps.output("body", prBody(verdict, issue, deps.env.RUN_URL ?? ""))
  return 0
}

const COMMANDS = { intake, gate, report, pr } as const

export async function main(args: string[], deps: Deps): Promise<number> {
  const command = COMMANDS[args[0] as keyof typeof COMMANDS]
  if (!command) {
    deps.log(`Usage: node scripts/sentry-fix.ts <${Object.keys(COMMANDS).join("|")}>`)
    return 1
  }
  return command(deps)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = (name: string, value: string) => {
    if (!process.env.GITHUB_OUTPUT) return process.stdout.write(`${name}=${value}\n`)
    const delimiter = `EOF_${Math.random().toString(36).slice(2)}`
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`)
  }
  main(process.argv.slice(2), {
    env: process.env,
    fetch,
    now: () => new Date(),
    output,
    log: (message) => process.stdout.write(`${message}\n`),
    readFile: (path) => readFileSync(path, "utf8"),
  }).then(
    (code) => (process.exitCode = code),
    (error: Error) => {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = 1
    },
  )
}
