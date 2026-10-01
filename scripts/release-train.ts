/**
 * The weekly release train, run by .github/workflows/release-train.yml under
 * plain Node 24 (no install needed):
 *
 *   TRAIN_STEP=cut node scripts/release-train.ts       # Tuesdays
 *   TRAIN_STEP=promote node scripts/release-train.ts   # Saturdays
 *
 * A release is cut in two steps, so what reaches production has spent a few
 * days on staging first. Articles publish on Mondays, so a release goes live on
 * Saturday, and its candidate is cut on the Tuesday before:
 *
 *   1. Cut a candidate: open a PR into dev that bumps package.json to the next
 *      version, worked out from the commit subjects since the last candidate
 *      (a `!` makes it major, any `feat` minor, anything else a patch). Once a
 *      person merges it, that bump commit is the candidate, and everything up
 *      to it is what the release will hold.
 *   2. Promote it: once the candidate has been on dev for SOAK_DAYS, open a
 *      PR into main from a branch at that bump commit (not dev's tip, which
 *      has kept moving). A person merges it with a merge commit, as release
 *      PRs always have been; release.yml then tags it.
 *
 * TRAIN_STEP picks which step a run takes: `cut`, `promote`, or `all` (the
 * default, for running it by hand), which promotes the candidate that has
 * settled and cuts the next one from what landed since. While a candidate is still settling no new one is cut, so
 * there is only ever one at a time. The bump lands on dev before it reaches
 * main, so main never holds a commit dev lacks and nothing is back-merged.
 *
 * The exception is a hotfix (`pnpm hotfix`), which reaches main straight from
 * its own branch. A candidate cut before it changed the same "version" line,
 * so its release PR would conflict. Every promotion and cut is first checked
 * with a trial merge into main (`git merge-tree`): a conflicting candidate is
 * skipped as stale, its release PR closed, and nothing is cut until the
 * hotfix is back-merged into dev. The next candidate is then cut above the
 * stale one, so versions never repeat.
 *
 * Only a `!` in the subject marks a commit breaking, never `BREAKING CHANGE`
 * in its body: squash commits carry the PR description, and Dependabot's
 * quote upstream changelogs that say it about their own releases.
 *
 * The workflow runs this with a GitHub App token (or a PAT), not its own: CI
 * doesn't run on PRs the workflow's token opens, and both PRs need CI. Every
 * write goes through the API, so the bump commit is signed by GitHub.
 * DRY_RUN=true reports the plan and writes nothing.
 */
import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

/** Subject of a candidate's bump commit, as `pnpm release` writes it too. */
export const bumpMessage = (version: string): string => `Bump package.json to v${version}`
const BUMP_RE = /^Bump package\.json to v(\d+\.\d+\.\d+)\b/
const REVERT_RE = /^revert\b/i
const TYPE_RE = /^(\w+)(?:\([^)]*\))?(!)?:/

/** Branch the promotion PR into main is opened from, at the candidate's commit. */
export const releaseBranch = (version: string): string => `release-train/v${version}`
/** Branch the bump PR into dev is opened from. */
export const bumpBranch = (version: string): string => `release-train/bump-v${version}`
const RELEASE_PREFIX = "release-train/v"
const BUMP_PREFIX = "release-train/bump-v"

const DAY_MS = 24 * 60 * 60 * 1000
/**
 * The runs are at 16:00 UTC (9am Pacific / noon Eastern). Tuesday to Saturday is
 * four days, less the time the bump PR waits for someone to merge it: a
 * candidate merged by Wednesday 9am Pacific / noon Eastern goes out that
 * Saturday.
 */
export const DEFAULT_SOAK_DAYS = 3

export type Step = "cut" | "promote" | "all"
const STEPS: Step[] = ["cut", "promote", "all"]

export function parseStep(value: string | undefined): Step {
  const step = value?.trim() || "all"
  if (!STEPS.includes(step as Step))
    throw new Error(`TRAIN_STEP must be one of ${STEPS.join(", ")}, not "${value}"`)
  return step as Step
}

/** The plan with the step this run doesn't take left out. */
export function forStep(plan: Plan, step: Step): Plan {
  const { promote, cut, ...rest } = plan
  return {
    ...rest,
    ...(step !== "cut" && promote && { promote }),
    ...(step !== "promote" && cut && { cut }),
  }
}

// ── Versions ───────────────────────────────────────────────────────────────

export type Level = "major" | "minor" | "patch"

function parts(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`Not a version: "${version}"`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)]
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

export function bumpVersion(version: string, level: Level): string {
  const [major, minor, patch] = parts(version)
  if (level === "major") return `${major + 1}.0.0`
  if (level === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/** The version a candidate's bump commit sets, or undefined for any other commit. */
export function candidateVersion(subject: string): string | undefined {
  return BUMP_RE.exec(subject)?.[1]
}

// ── Commits ────────────────────────────────────────────────────────────────

export interface Commit {
  sha: string
  /** When it landed on dev (committer date, ISO 8601). */
  date: string
  subject: string
}

/** Conventional-commit type, lowercased (Dependabot writes `Chore`), and whether it has a `!`. */
export function commitType(subject: string): { type: string; breaking: boolean } | undefined {
  const match = TYPE_RE.exec(subject)
  return match ? { type: match[1]!.toLowerCase(), breaking: match[2] === "!" } : undefined
}

export function releaseLevel(commits: Commit[]): Level {
  const types = commits.map((c) => commitType(c.subject))
  if (types.some((t) => t?.breaking)) return "major"
  if (types.some((t) => t?.type === "feat")) return "minor"
  return "patch"
}

const SECTIONS: [string, (t: ReturnType<typeof commitType>) => boolean][] = [
  ["Breaking changes", (t) => !!t?.breaking],
  ["Features", (t) => t?.type === "feat"],
  ["Fixes", (t) => t?.type === "fix"],
  ["Other changes", () => true],
]

/** Commits grouped under `###` headings, newest first. The `(#123)` in a subject links its PR. */
export function releaseNotes(commits: Commit[]): string {
  const left = [...commits]
  const sections: string[] = []
  for (const [heading, matches] of SECTIONS) {
    const taken = left.filter((c) => matches(commitType(c.subject)))
    if (taken.length === 0) continue
    for (const c of taken) left.splice(left.indexOf(c), 1)
    sections.push(`### ${heading}\n\n${taken.map((c) => `- ${c.subject}`).join("\n")}`)
  }
  return sections.join("\n\n")
}

/** Parse `git log --format=%H%x1f%cI%x1f%s`. */
export function parseLog(log: string): Commit[] {
  return log
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha = "", date = "", subject = ""] = line.split("\x1f")
      return { sha, date, subject }
    })
}

// ── Plan ───────────────────────────────────────────────────────────────────

export interface Candidate {
  version: string
  commit: Commit
  /** Days it has been on dev. */
  age: number
}

export interface Plan {
  /** The settled candidate to open (or refresh) the release PR for. */
  promote?: Candidate & {
    /** What the release holds, bump commits left out. */
    notes: Commit[]
    /** Reverts that landed on dev after the candidate was cut. */
    reverts: Commit[]
  }
  /** A candidate still settling; no new one is cut until it has. */
  waiting?: Candidate
  /** The newest candidate that conflicts with main (a hotfix landed after it); never promoted. */
  stale?: Candidate
  /** Dev itself conflicts with main, so nothing is cut until main is back-merged. */
  blocked?: true
  /** The next candidate to open (or refresh) the bump PR for. */
  cut?: {
    version: string
    /** The version it follows: the last candidate, or main's when there is none. */
    from: string
    level: Level
    commits: Commit[]
  }
}

/**
 * Decide what this run does from main's version and dev's first-parent
 * commits that main doesn't have, newest first. `mergesCleanly` says whether
 * a commit merges into main without conflicts.
 */
export function planTrain({
  mainVersion,
  commits,
  now,
  soakDays,
  mergesCleanly,
}: {
  mainVersion: string
  commits: Commit[]
  now: number
  soakDays: number
  mergesCleanly: (sha: string) => boolean
}): Plan {
  // A bump at or below main's version was released, or overtaken by a hotfix.
  const candidates = commits.flatMap((commit, index) => {
    const version = candidateVersion(commit.subject)
    if (!version || compareVersions(version, mainVersion) <= 0) return []
    return [
      {
        version,
        commit,
        index,
        age: (now - Date.parse(commit.date)) / DAY_MS,
        clean: mergesCleanly(commit.sha),
      },
    ]
  })
  const strip = ({ version, commit, age }: (typeof candidates)[number]): Candidate => ({
    version,
    commit,
    age,
  })
  const plan: Plan = {}

  const settled = candidates.find((c) => c.clean && c.age >= soakDays)
  if (settled) {
    plan.promote = {
      ...strip(settled),
      notes: commits.slice(settled.index).filter((c) => !candidateVersion(c.subject)),
      reverts: commits.slice(0, settled.index).filter((c) => REVERT_RE.test(c.subject)),
    }
  }

  const stale = candidates.find((c) => !c.clean)
  if (stale) plan.stale = strip(stale)

  // A stale candidate will never settle, so it holds nothing up.
  const newest = candidates[0]
  if (newest && newest !== settled && newest.clean) {
    plan.waiting = strip(newest)
    return plan
  }

  const pending = commits
    .slice(0, newest?.index ?? commits.length)
    .filter((c) => !candidateVersion(c.subject))
  if (pending.length > 0 && !mergesCleanly(pending[0]!.sha)) {
    plan.blocked = true
  } else if (pending.length > 0) {
    const from = newest?.version ?? mainVersion
    // Above a stale candidate, level by everything unreleased: its features
    // never shipped, so the next version still has to say so.
    const level = releaseLevel(
      newest && !newest.clean ? commits.filter((c) => !candidateVersion(c.subject)) : pending,
    )
    plan.cut = { version: bumpVersion(from, level), from, level, commits: pending }
  }
  return plan
}

// ── Descriptions ───────────────────────────────────────────────────────────

const short = (sha: string) => sha.slice(0, 7)
const days = (age: number) => `${Math.floor(age)} day${Math.floor(age) === 1 ? "" : "s"}`
const MARKER = "<!-- release-train -->"

export function releaseBody(promote: NonNullable<Plan["promote"]>): string {
  const { version, commit, age, notes, reverts } = promote
  const lines = [
    `Promotes the release candidate v${version} (${commit.sha}), which has been on dev and staging for ${days(age)}.`,
    "",
    `Merge with a **merge commit**. Don't squash it, and don't click "Update branch": either one leaves dev and main diverged. Merging deploys production, and release.yml tags v${version}.`,
    "",
    "If GitHub reports conflicts, a hotfix has reached main since this was opened. Don't resolve them here: back-merge the hotfix into dev, and the next run closes this PR and cuts a fresh candidate.",
  ]
  if (reverts.length > 0) {
    lines.push(
      "",
      "> [!WARNING]",
      "> These reverts landed on dev after the candidate was cut. If one undoes a change listed below, close this PR to hold the release; next Saturday's run offers a newer candidate.",
      ">",
      ...reverts.map((c) => `> - ${c.subject}`),
    )
  }
  lines.push("", "## Changes", "", releaseNotes(notes), "", MARKER)
  return lines.join("\n")
}

export function bumpBody(cut: NonNullable<Plan["cut"]>, soakDays: number): string {
  const why = {
    major: "a commit is marked breaking (`!`)",
    minor: "it adds features",
    patch: "it adds no features",
  }[cut.level]
  return [
    `Cuts v${cut.version} as the next release candidate: a ${cut.level} release after v${cut.from}, because ${why}.`,
    "",
    `Once this merges, the candidate settles on staging, and the first Saturday run at least ${days(soakDays)} later opens its release PR into main. It holds everything on dev up to this commit. The release train refreshes this PR each Tuesday until it merges, taking in what landed since.`,
    "",
    `## Changes since v${cut.from}`,
    "",
    releaseNotes(cut.commits),
    "",
    MARKER,
  ].join("\n")
}

export function describePlan(plan: Plan, mainVersion: string, step: Step = "all"): string {
  const lines = [`Production (main) is on v${mainVersion}.`]
  if (plan.promote) {
    lines.push(
      `- Promote v${plan.promote.version} (${short(plan.promote.commit.sha)}, on dev for ${days(plan.promote.age)}).`,
    )
  }
  if (plan.waiting) {
    lines.push(
      `- v${plan.waiting.version} (${short(plan.waiting.commit.sha)}) has been on dev for ${days(plan.waiting.age)}; it's promoted once it has settled, and nothing new is cut until then.`,
    )
  }
  if (plan.stale) {
    lines.push(
      `- v${plan.stale.version} (${short(plan.stale.commit.sha)}) conflicts with main, where a hotfix landed after it was cut; it won't be promoted.`,
    )
  }
  if (plan.blocked) {
    lines.push(
      "- dev conflicts with main: back-merge the hotfix into dev (`pnpm hotfix <version> --phase 2`). Nothing is cut until then.",
    )
  } else if (plan.cut) {
    lines.push(
      `- Cut v${plan.cut.version} (${plan.cut.level}) from ${plan.cut.commits.length} commit(s) since v${plan.cut.from}.`,
    )
  } else if (step === "promote") {
    lines.push("- Cutting is left to Tuesday's run.")
  } else if (!plan.waiting) {
    lines.push("- Nothing has landed on dev since the last candidate; nothing to cut.")
  }
  if (step === "cut") lines.push("- Promoting is left to Saturday's run.")
  return lines.join("\n")
}

// ── GitHub ─────────────────────────────────────────────────────────────────

/** The workflow's env; not NodeJS.ProcessEnv, which the app's typings narrow. */
export type Env = Record<string, string | undefined>

export interface Deps {
  fetch: typeof fetch
  /** Runs git in the checkout, returning stdout. */
  git: (args: string[]) => string
  now: () => number
  log: (message: string) => void
  /** Adds to the job summary (GITHUB_STEP_SUMMARY). */
  summary: (markdown: string) => void
}

interface Pull {
  number: number
  html_url: string
  head: { ref: string; sha: string }
}

function github(deps: Deps, repo: string, token: string) {
  const call = async (
    path: string,
    init: { method?: string; body?: unknown; raw?: boolean } = {},
  ) => {
    const url = `https://api.github.com/repos/${repo}${path}`
    const res = await deps.fetch(url, {
      method: init.method,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        Accept: init.raw ? "application/vnd.github.raw" : "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body !== undefined && { "Content-Type": "application/json" }),
      },
    })
    if (!res.ok) {
      const error = new Error(
        `${init.method ?? "GET"} ${url} → ${res.status}: ${(await res.text()).slice(0, 500)}`,
      ) as Error & { status: number }
      error.status = res.status
      throw error
    }
    return res
  }
  const json = async <T>(path: string, init?: { method?: string; body?: unknown }) =>
    (await (await call(path, init)).json()) as T

  return {
    openPulls: (base: string) => json<Pull[]>(`/pulls?state=open&base=${base}&per_page=100`),
    createPull: (body: { title: string; head: string; base: string; body: string }) =>
      json<Pull>("/pulls", { method: "POST", body }),
    updatePull: (pr: number, body: { title: string; body: string }) =>
      json(`/pulls/${pr}`, { method: "PATCH", body }),
    closePull: async (pr: number, comment: string) => {
      await json(`/issues/${pr}/comments`, { method: "POST", body: { body: comment } })
      await json(`/pulls/${pr}`, { method: "PATCH", body: { state: "closed" } })
    },
    /** Point a branch at a commit, creating it or force-moving it. */
    setBranch: async (branch: string, sha: string) => {
      try {
        await call(`/git/ref/heads/${branch}`)
      } catch (err) {
        if ((err as { status?: number }).status !== 404) throw err
        return json("/git/refs", { method: "POST", body: { ref: `refs/heads/${branch}`, sha } })
      }
      return json(`/git/refs/heads/${branch}`, { method: "PATCH", body: { sha, force: true } })
    },
    deleteBranch: (branch: string) =>
      call(`/git/refs/heads/${branch}`, { method: "DELETE" }).catch((err) => {
        // Already gone.
        if ((err as { status?: number }).status !== 422) throw err
      }),
    file: async (path: string, ref: string) =>
      (await call(`/contents/${path}?ref=${encodeURIComponent(ref)}`, { raw: true })).text(),
    commit: (sha: string) =>
      json<{ sha: string; tree: { sha: string }; parents: { sha: string }[] }>(
        `/git/commits/${sha}`,
      ),
    /** Commit one changed file on top of `parent`. With no author given, GitHub signs it. */
    commitFile: async (parent: string, path: string, content: string, message: string) => {
      const base = await json<{ tree: { sha: string } }>(`/git/commits/${parent}`)
      const tree = await json<{ sha: string }>("/git/trees", {
        method: "POST",
        body: {
          base_tree: base.tree.sha,
          tree: [{ path, mode: "100644", type: "blob", content }],
        },
      })
      return json<{ sha: string }>("/git/commits", {
        method: "POST",
        body: { message, tree: tree.sha, parents: [parent] },
      })
    },
  }
}

type Github = ReturnType<typeof github>

/** Set `"version"` in package.json's text, leaving the rest as written. */
export function withVersion(packageJson: string, version: string): string {
  return packageJson.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`)
}

/**
 * Open the train's PR for `branch` → `base`, or refresh the one already open,
 * and close any other the train left open into `base` as superseded.
 */
async function syncPull(
  gh: Github,
  deps: Deps,
  {
    base,
    prefix,
    branch,
    title,
    body,
  }: { base: string; prefix: string; branch: string; title: string; body: string },
  moveBranch: (current: Pull | undefined) => Promise<void>,
): Promise<Pull | undefined> {
  const open = (await gh.openPulls(base)).filter((p) => p.head.ref.startsWith(prefix))
  const current = open.find((p) => p.head.ref === branch)
  await moveBranch(current)
  let pull = current
  if (pull) {
    await gh.updatePull(pull.number, { title, body })
    deps.log(`Refreshed ${pull.html_url}`)
  } else {
    pull = await gh.createPull({ title, head: branch, base, body })
    deps.log(`Opened ${pull.html_url}`)
  }
  for (const stale of open.filter((p) => p !== current)) {
    await gh.closePull(stale.number, `Superseded by #${pull.number}.`)
    await gh.deleteBranch(stale.head.ref)
    deps.log(`Closed #${stale.number} (${stale.head.ref}) as superseded.`)
  }
  return pull
}

function required(env: Env, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

export async function main(env: Env, deps: Deps): Promise<number> {
  try {
    const soakDays = Number(env.SOAK_DAYS?.trim() || DEFAULT_SOAK_DAYS)
    if (!Number.isFinite(soakDays) || soakDays < 0)
      throw new Error(`SOAK_DAYS must be a number of days, not "${env.SOAK_DAYS}"`)
    const step = parseStep(env.TRAIN_STEP)

    const mainVersion = (
      JSON.parse(deps.git(["show", "origin/main:package.json"])) as {
        version: string
      }
    ).version
    const commits = parseLog(
      deps.git(["log", "--first-parent", "--format=%H%x1f%cI%x1f%s", "origin/dev", "^origin/main"]),
    )
    // A trial merge in memory: merge-tree exits 1 when the merge conflicts.
    const mergesCleanly = (sha: string) => {
      try {
        deps.git(["merge-tree", "--write-tree", "origin/main", sha])
        return true
      } catch (err) {
        if ((err as { status?: number }).status === 1) return false
        throw err
      }
    }
    const plan = forStep(
      planTrain({ mainVersion, commits, now: deps.now(), soakDays, mergesCleanly }),
      step,
    )
    const description = describePlan(plan, mainVersion, step)
    deps.log(description)
    deps.summary(description)
    if (env.DRY_RUN === "true") {
      deps.log("Dry run: nothing written.")
      return 0
    }

    const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))

    const { promote, stale, cut } = plan
    if (stale && !promote) {
      for (const pull of await gh.openPulls("main")) {
        if (pull.head.ref !== releaseBranch(stale.version)) continue
        await gh.closePull(
          pull.number,
          `Closed: a hotfix reached main after v${stale.version} was cut, so this conflicts. Back-merge the hotfix into dev; the next run cuts a fresh candidate.`,
        )
        await gh.deleteBranch(pull.head.ref)
        deps.log(`Closed #${pull.number}: v${stale.version} conflicts with main.`)
      }
    }
    if (promote) {
      await syncPull(
        gh,
        deps,
        {
          base: "main",
          prefix: RELEASE_PREFIX,
          branch: releaseBranch(promote.version),
          title: `Release ${promote.version}`,
          body: releaseBody(promote),
        },
        async () => {
          await gh.setBranch(releaseBranch(promote.version), promote.commit.sha)
        },
      )
    }

    if (cut) {
      const devSha = deps.git(["rev-parse", "origin/dev"]).trim()
      const branch = bumpBranch(cut.version)
      await syncPull(
        gh,
        deps,
        {
          base: "dev",
          prefix: BUMP_PREFIX,
          branch,
          title: bumpMessage(cut.version),
          body: bumpBody(cut, soakDays),
        },
        async (current) => {
          // Already a bump on dev's tip: leave it, so its CI and approval stand.
          if (current && (await gh.commit(current.head.sha)).parents[0]?.sha === devSha) return
          const pkg = await gh.file("package.json", devSha)
          const bump = await gh.commitFile(
            devSha,
            "package.json",
            withVersion(pkg, cut.version),
            bumpMessage(cut.version),
          )
          await gh.setBranch(branch, bump.sha)
        },
      )
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
    git: (args) => execFileSync("git", args, { encoding: "utf8" }),
    now: () => Date.now(),
    log: (message) => process.stdout.write(`${message}\n`),
    summary: (markdown) => {
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
    },
  })
}
