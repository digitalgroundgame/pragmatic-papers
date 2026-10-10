/**
 * The PR side of CI's "Deploy Storybook" job (.github/workflows/ci.yml), run
 * under plain Node 24 (no install needed):
 *
 *   node scripts/storybook-pr.ts deploy   # after a preview upload: record it as a Deployment
 *   node scripts/storybook-pr.ts link     # then link the components it changes
 *   node scripts/storybook-pr.ts close    # PR closed or merged (.github/workflows/storybook-close.yml)
 *
 * `deploy` records the preview as a GitHub Deployment of the PR's branch in the
 * "Storybook Preview" environment, so the PR's deployments list it next to the
 * site's Preview (scripts/preview-deployment.ts), and marks the PR's older ones
 * inactive. `close` marks all of them inactive, as the site's Preview does;
 * storybook-close.yml then deletes the Worker Preview itself.
 *
 * `link` rewrites the block between LINKS_START and LINKS_END in the PR's
 * description: a link to each component the PR changes in the preview. It goes
 * under the showcase links and the links line, else at the top (see
 * scripts/pr-description.ts), where reviewers see it first. A PR that changes no
 * component gets no block, and loses one it had.
 *
 * A component is matched through the build's index.json: a changed file that
 * is a story file or a story's `component`, else the stories nearest above it
 * (say `Media/CMSImage/index.tsx` under `Media/Media.stories.tsx`), as long
 * as that folder has only a few of them: a helper in `components/ui` shouldn't
 * list all 27 primitives.
 *
 * Edits made with the workflow's token start no workflow, so this can't loop.
 */
import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { blockEnd, blockStart, editPrBody, renderBlock, withBlock } from "./pr-description.ts"

export const LINKS_START = blockStart("storybook-links")
export const LINKS_END = blockEnd("storybook-links")
export const ENVIRONMENT = "Storybook Preview"

/** More components than this are summarised as "and N more". */
export const MAX_COMPONENTS = 20
/** A folder with more stories than this is too broad to match a file by folder alone. */
export const MAX_STORIES_PER_FOLDER = 3

/** Changed files that never render a component on their own. */
const IGNORED = /(^|\/)__tests__\/|\.test\.tsx?$|^src\/migrations\/|^src\/payload-types\.ts$/

/** An entry of Storybook's index.json. */
export interface IndexEntry {
  id: string
  title: string
  type: "docs" | "story"
  importPath: string
  componentPath?: string
}

export interface Component {
  title: string
  /** The entry to link: the component's docs page, else its first story. */
  id: string
  type: "docs" | "story"
}

const repoPath = (path: string) => path.replace(/^\.\//, "")
const dirname = (path: string) => path.slice(0, Math.max(path.lastIndexOf("/"), 0))

/** The components a PR's changed files touch, sorted by title. */
export function changedComponents(files: string[], entries: IndexEntry[]): Component[] {
  const titles = new Set<string>()
  const byFolder = new Map<string, Set<string>>()
  for (const entry of entries) {
    const folder = dirname(repoPath(entry.importPath))
    byFolder.set(folder, (byFolder.get(folder) ?? new Set()).add(entry.title))
  }

  for (const file of files) {
    if (!file.startsWith("src/") || IGNORED.test(file)) continue
    const direct = entries.filter(
      (entry) =>
        repoPath(entry.importPath) === file ||
        (entry.componentPath && repoPath(entry.componentPath) === file),
    )
    if (direct.length > 0) {
      for (const entry of direct) titles.add(entry.title)
      continue
    }
    for (let folder = dirname(file); folder.includes("/"); folder = dirname(folder)) {
      const nearest = byFolder.get(folder)
      if (!nearest) continue
      if (nearest.size <= MAX_STORIES_PER_FOLDER) for (const title of nearest) titles.add(title)
      break
    }
  }

  return [...titles].sort().map((title) => {
    const ofTitle = entries.filter((entry) => entry.title === title)
    const entry = ofTitle.find((e) => e.type === "docs") ?? ofTitle[0]!
    return { title, id: entry.id, type: entry.type }
  })
}

/** The block's content: a link to each component the PR changes, or null when there are none. */
export function linksBlock(previewUrl: string, components: Component[]): string | null {
  if (components.length === 0) return null
  const base = previewUrl.replace(/\/$/, "")
  const lines = ["**Storybook** — components this PR changes:"]
  for (const { title, id, type } of components.slice(0, MAX_COMPONENTS))
    lines.push(`- [${title}](${base}/?path=/${type}/${id})`)
  const more = components.length - MAX_COMPONENTS
  if (more > 0) lines.push(`- …and ${more} more`)
  return renderBlock("storybook-links", lines.join("\n"))
}

/** Replaces the block, or adds it (see scripts/pr-description.ts); null removes it. */
export function withStorybookLinks(body: string, block: string | null): string {
  return withBlock(body, "storybook-links", block)
}

/** The workflow's env; not NodeJS.ProcessEnv, which the app's typings narrow. */
export type Env = Record<string, string | undefined>

export interface Deps {
  fetch: typeof fetch
  log: (message: string) => void
  /** Adds to the job summary (GITHUB_STEP_SUMMARY). */
  summary: (markdown: string) => void
  readFile: (path: string) => string
  sleep: (ms: number) => Promise<void>
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
    pull: (pr: number) => json<{ head: { ref: string } }>(`/pulls/${pr}`),
    /** The files the PR adds or changes (GitHub lists at most 3,000). */
    files: async (pr: number) => {
      const files: string[] = []
      for (let page = 1; page <= 30; page++) {
        const batch = await json<{ filename: string; status: string }[]>(
          `/pulls/${pr}/files?per_page=100&page=${page}`,
        )
        for (const file of batch) if (file.status !== "removed") files.push(file.filename)
        if (batch.length < 100) break
      }
      return files
    },
    createDeployment: (ref: string, pr: number) =>
      json<{ id: number }>("/deployments", {
        method: "POST",
        body: {
          ref,
          environment: ENVIRONMENT,
          description: `Storybook for PR #${pr}`,
          auto_merge: false,
          // CI is still running; the preview is already built from tested code.
          required_contexts: [],
          transient_environment: true,
          production_environment: false,
          payload: { pr },
        },
      }),
    deployments: (ref: string) =>
      json<{ id: number }[]>(
        `/deployments?environment=${encodeURIComponent(ENVIRONMENT)}&ref=${encodeURIComponent(ref)}&per_page=100`,
      ),
    setStatus: (id: number, state: "success" | "inactive", environmentUrl?: string) =>
      json(`/deployments/${id}/statuses`, {
        method: "POST",
        body: {
          state,
          environment: ENVIRONMENT,
          ...(environmentUrl && { environment_url: environmentUrl }),
          // Other PRs share the environment: only this PR's are marked inactive, below.
          auto_inactive: false,
        },
      }),
  }
}

async function deploy(env: Env, deps: Deps): Promise<void> {
  const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))
  const pr = Number(required(env, "PR_NUMBER"))
  const url = required(env, "PREVIEW_URL")
  // The branch, not the commit, is what ties a Deployment to the PR.
  const ref = (await gh.pull(pr)).head.ref
  const { id } = await gh.createDeployment(ref, pr)
  await gh.setStatus(id, "success", url)
  for (const old of await gh.deployments(ref))
    if (old.id !== id) await gh.setStatus(old.id, "inactive")
  deps.log(`Recorded ${url} as a ${ENVIRONMENT} deployment of ${ref}.`)
}

async function close(env: Env, deps: Deps): Promise<void> {
  const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))
  const ref = (await gh.pull(Number(required(env, "PR_NUMBER")))).head.ref
  const deployments = await gh.deployments(ref)
  for (const { id } of deployments) await gh.setStatus(id, "inactive")
  deps.log(`Marked ${deployments.length} ${ENVIRONMENT} deployment(s) of ${ref} inactive.`)
}

async function link(env: Env, deps: Deps): Promise<void> {
  const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))
  const pr = Number(required(env, "PR_NUMBER"))
  const index = JSON.parse(deps.readFile(required(env, "INDEX_FILE"))) as {
    entries: Record<string, IndexEntry>
  }
  const components = changedComponents(await gh.files(pr), Object.values(index.entries))
  const block = linksBlock(required(env, "PREVIEW_URL"), components)
  const target = {
    repo: required(env, "GITHUB_REPOSITORY"),
    prNumber: pr,
    token: required(env, "GITHUB_TOKEN"),
  }
  if (
    (await editPrBody(
      target,
      (body) => withStorybookLinks(body, block),
      "Storybook links",
      deps,
    )) === null
  )
    return
  deps.log(`Linked ${components.length} changed component(s) in the description.`)
  if (block) deps.summary(block.split("\n").slice(1, -1).join("\n"))
}

const COMMANDS = { deploy, link, close }

export async function main(argv: string[], env: Env, deps: Deps): Promise<number> {
  const command = COMMANDS[argv[0] as keyof typeof COMMANDS]
  if (!command) {
    deps.log("Usage: node scripts/storybook-pr.ts deploy|link|close")
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
  process.exitCode = await main(process.argv.slice(2), process.env, {
    fetch: (...args) => fetch(...args),
    log: (message) => process.stdout.write(`${message}\n`),
    summary: (markdown) => {
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
    },
    readFile: (path) => readFileSync(path, "utf8"),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  })
}
