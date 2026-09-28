/**
 * The PR side of .github/workflows/showcase.yml, run under plain Node 24 (no
 * install needed):
 *
 *   node scripts/showcase-pr.ts sync      # label added/removed, PR opened or its description edited
 *   node scripts/showcase-pr.ts resolve   # before a push: which PR, and is it ready?
 *   node scripts/showcase-pr.ts link      # after a push: list the articles in the description
 *
 * `sync` keeps the "showcase" label and the description's `Showcase:` line in
 * step. Adding the label inserts a line naming the articles the PR adds to
 * src/endpoints/seed/showcase.ts (usually its one demo article); if it adds
 * none, the label comes off again. A line adds the label. Removing either
 * removes the other, along with the link list.
 *
 * `resolve` checks a PR is from this repository, and for automatic runs that
 * it has a `Showcase:` line and a live preview: a successful Preview
 * Deployment for its head commit (see scripts/preview-deployment.ts).
 *
 * `link` rewrites the list of links between the LINKS_START and LINKS_END
 * markers from the file `pnpm showcase` writes to SHOWCASE_LINKS_FILE.
 *
 * Edits made with the workflow's token start no workflow, so none of this
 * can loop.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const LABEL = "showcase"
export const CATALOG = "src/endpoints/seed/showcase.ts"
export const ENVIRONMENT = "Preview"
export const LINKS_START = "<!-- showcase-links -->"
export const LINKS_END = "<!-- /showcase-links -->"

/** A `Showcase:` line, as scripts/showcase.ts reads it (slugsFromDescription). */
export const SHOWCASE_LINE = /^[\s>*_-]*showcase\s*:[*_\s]*(.*)$/im

const LINKS_BLOCK = new RegExp(`${LINKS_START}[\\s\\S]*?${LINKS_END}`)

export function hasShowcaseLine(body: string): boolean {
  return SHOWCASE_LINE.test(body)
}

/** Appends a `Showcase:` line naming the slugs. */
export function withShowcaseLine(body: string, slugs: string[]): string {
  return `${body.trimEnd()}\n\nShowcase: ${slugs.join(" ")}\n`
}

/** Removes the `Showcase:` lines and the link list. */
export function optOut(body: string): string {
  const lineOnly = new RegExp(SHOWCASE_LINE.source, "i")
  return body
    .replace(LINKS_BLOCK, "")
    .split(/\r?\n/)
    .filter((line) => !lineOnly.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
}

/** Replaces the link list, or appends one; no links removes it. */
export function withLinks(body: string, links: string[]): string {
  if (links.length === 0) return body.replace(LINKS_BLOCK, "").trimEnd()
  const block = `${LINKS_START}\n**On the preview:**\n\n${links.join("\n")}\n${LINKS_END}`
  return LINKS_BLOCK.test(body)
    ? body.replace(LINKS_BLOCK, () => block)
    : `${body.trimEnd()}\n\n${block}\n`
}

/** The slugs registered in a version of the catalog's source. */
export function catalogSlugs(source: string): string[] {
  return [...source.matchAll(/^\s*slug: "([a-z0-9-]+)"/gm)].map((m) => m[1]!)
}

/** The slugs in `head`'s catalog that `base`'s lacks. */
export function addedSlugs(base: string, head: string): string[] {
  const before = new Set(catalogSlugs(base))
  return catalogSlugs(head).filter((slug) => !before.has(slug))
}

export type SyncAction = "opened" | "edited" | "labeled" | "unlabeled"

export interface SyncPlan {
  /** The new description, when it changes. */
  body?: string
  label?: "add" | "remove"
  /** Whether to push now. */
  push: boolean
  notice?: string
}

/**
 * What a PR event means for the label and the line. `added` (the slugs the PR
 * adds to the catalog) is only consulted when the label is added without a line.
 */
export async function planSync(
  action: SyncAction,
  body: string,
  hasLabel: boolean,
  added: () => Promise<string[]>,
): Promise<SyncPlan> {
  const hasLine = hasShowcaseLine(body)
  const changed = (next: string) => (next === body ? undefined : next)

  switch (action) {
    case "labeled": {
      if (hasLine) return { push: true }
      const slugs = await added()
      if (slugs.length > 0) return { body: withShowcaseLine(body, slugs), push: true }
      return {
        label: "remove",
        push: false,
        notice:
          `This PR adds no article to ${CATALOG}, so there's nothing to showcase; removed the ` +
          `label. To push existing articles, add a "Showcase: <slug...>" line instead.`,
      }
    }
    case "unlabeled":
      return { body: changed(optOut(body)), push: false }
    case "opened":
    case "edited":
      if (hasLine) return { label: hasLabel ? undefined : "add", push: true }
      return {
        body: changed(optOut(body)),
        label: hasLabel ? "remove" : undefined,
        push: false,
      }
  }
}

/** The workflow's env; not NodeJS.ProcessEnv, which the app's typings narrow. */
export type Env = Record<string, string | undefined>

export interface Deps {
  fetch: typeof fetch
  log: (message: string) => void
  /** Sets a step output (GITHUB_OUTPUT). */
  output: (name: string, value: string) => void
  /** Adds to the job summary (GITHUB_STEP_SUMMARY). */
  summary: (markdown: string) => void
  readFile: (path: string) => string
  writeFile: (path: string, content: string) => void
}

interface Pull {
  body: string | null
  head: { sha: string; ref: string; repo: { full_name: string } | null }
}

export interface GithubApi {
  pull: (pr: number) => Promise<Pull>
  setBody: (pr: number, body: string) => Promise<unknown>
  addLabel: (pr: number) => Promise<unknown>
  removeLabel: (pr: number) => Promise<unknown>
  /** A file's content at a ref, or "" when it doesn't exist there. */
  file: (path: string, ref: string) => Promise<string>
  /** Whether the latest Preview Deployment of the commit succeeded. */
  previewIsUp: (ref: string, sha: string) => Promise<boolean>
}

export function github(deps: Deps, repo: string, token: string): GithubApi {
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
    pull: (pr: number) => json<Pull>(`/pulls/${pr}`),
    setBody: (pr: number, body: string) =>
      json(`/pulls/${pr}`, { method: "PATCH", body: { body } }),
    addLabel: (pr: number) =>
      json(`/issues/${pr}/labels`, { method: "POST", body: { labels: [LABEL] } }),
    removeLabel: (pr: number) =>
      call(`/issues/${pr}/labels/${LABEL}`, { method: "DELETE" }).catch((err) => {
        // Already gone.
        if ((err as { status?: number }).status !== 404) throw err
      }),
    file: async (path: string, ref: string) => {
      try {
        return await (
          await call(`/contents/${path}?ref=${encodeURIComponent(ref)}`, { raw: true })
        ).text()
      } catch (err) {
        if ((err as { status?: number }).status === 404) return ""
        throw err
      }
    },
    previewIsUp: async (ref: string, sha: string) => {
      const deployments = await json<{ id: number; sha: string }[]>(
        `/deployments?environment=${encodeURIComponent(ENVIRONMENT)}&ref=${encodeURIComponent(ref)}&per_page=100`,
      )
      const latest = deployments.find((d) => d.sha === sha)
      if (!latest) return false
      const statuses = await json<{ state: string }[]>(
        `/deployments/${latest.id}/statuses?per_page=1`,
      )
      return statuses[0]?.state === "success"
    },
  }
}

function required(env: Env, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

function prNumber(value: string): number {
  if (!/^\d+$/.test(value))
    throw new Error(`Target must be a PR number or "staging", not "${value}".`)
  return Number(value)
}

async function sync(env: Env, deps: Deps): Promise<void> {
  const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))
  const pr = prNumber(required(env, "PR_NUMBER"))
  const action = required(env, "ACTION") as SyncAction
  const pull = await gh.pull(pr)
  const body = pull.body ?? ""

  const plan = await planSync(action, body, env.HAS_LABEL === "true", async () =>
    addedSlugs(
      await gh.file(CATALOG, required(env, "BASE_REF")),
      await gh.file(CATALOG, pull.head.sha),
    ),
  )
  if (plan.body !== undefined) {
    await gh.setBody(pr, plan.body)
    deps.log(
      hasShowcaseLine(plan.body)
        ? "Added a Showcase line."
        : "Removed the Showcase line and links.",
    )
  }
  if (plan.label === "add") {
    await gh.addLabel(pr)
    deps.log(`Added the ${LABEL} label.`)
  } else if (plan.label === "remove") {
    await gh.removeLabel(pr)
    deps.log(`Removed the ${LABEL} label.`)
  }
  if (plan.notice) {
    deps.log(`::notice::${plan.notice}`)
    deps.summary(plan.notice)
  }
  deps.output("push", String(plan.push))
}

async function resolve(env: Env, deps: Deps): Promise<void> {
  const repo = required(env, "GITHUB_REPOSITORY")
  const gh = github(deps, repo, required(env, "GITHUB_TOKEN"))
  const pr = prNumber(required(env, "PR_NUMBER"))
  const pull = await gh.pull(pr)
  const headRepo = pull.head.repo?.full_name
  if (headRepo !== repo) {
    throw new Error(
      `PR #${pr} comes from ${headRepo ?? "a deleted fork"}; only same-repository PRs are pushed.`,
    )
  }
  const body = pull.body ?? ""
  deps.writeFile(required(env, "DESCRIPTION_FILE"), body)
  deps.output("number", String(pr))
  deps.output("sha", pull.head.sha)

  // A manual run pushes when asked; an automatic one only when opted in and
  // the head commit's preview is up.
  if (env.MANUAL === "true") return
  let reason: string | undefined
  if (!hasShowcaseLine(body)) reason = `No Showcase line on PR #${pr}; nothing to push.`
  else if (!(await gh.previewIsUp(pull.head.ref, pull.head.sha)))
    reason = `The preview for ${pull.head.sha.slice(0, 7)} isn't up; its deploy will push.`
  if (reason) {
    deps.log(reason)
    deps.output("skip", "true")
  }
}

async function link(env: Env, deps: Deps): Promise<void> {
  const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))
  const pr = prNumber(required(env, "PR_NUMBER"))
  const links = deps
    .readFile(required(env, "LINKS_FILE"))
    .split("\n")
    .filter((line) => line.trim())
  // Read fresh, so an edit made during the push survives.
  const body = (await gh.pull(pr)).body ?? ""
  const next = withLinks(body, links)
  if (next !== body) {
    await gh.setBody(pr, next)
    deps.log(`Listed ${links.length} article(s) in the description.`)
  }
}

const COMMANDS = { sync, resolve, link }

export async function main(argv: string[], env: Env, deps: Deps): Promise<number> {
  const command = COMMANDS[argv[0] as keyof typeof COMMANDS]
  if (!command) {
    deps.log("Usage: node scripts/showcase-pr.ts <sync|resolve|link>")
    return 2
  }
  try {
    await command(env, deps)
    return 0
  } catch (err) {
    deps.log(`::error::${(err as Error).message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const append = (file: string | undefined, text: string) => {
    if (file) appendFileSync(file, text)
  }
  process.exitCode = await main(process.argv.slice(2), process.env, {
    fetch: (...args) => fetch(...args),
    log: (message) => process.stdout.write(`${message}\n`),
    output: (name, value) => append(process.env.GITHUB_OUTPUT, `${name}=${value}\n`),
    summary: (markdown) => append(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`),
    readFile: (path) => readFileSync(path, "utf8"),
    writeFile: (path, content) => writeFileSync(path, content),
  })
}
