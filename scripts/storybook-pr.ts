/**
 * The PR side of CI's "Deploy Storybook" job (.github/workflows/ci.yml), run
 * under plain Node 24 (no install needed):
 *
 *   node scripts/storybook-pr.ts link   # after a preview upload: list it in the description
 *
 * `link` rewrites the block between LINKS_START and LINKS_END in the PR's
 * description: the Storybook preview, then a link to each component the PR
 * changes. It goes under the showcase links when there are any (see
 * scripts/showcase-pr.ts), else at the top under any `Closes #N` lines, where
 * reviewers see it first.
 *
 * A component is matched through the build's index.json: a changed file that
 * is a story file or a story's `component`, else the stories nearest above it
 * (say `Media/ImageMedia/index.tsx` under `Media/Media.stories.tsx`), as long
 * as that folder has only a few of them: a helper in `components/ui` shouldn't
 * list all 27 primitives.
 *
 * Edits made with the workflow's token start no workflow, so this can't loop.
 */
import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const LINKS_START = "<!-- storybook-links -->"
export const LINKS_END = "<!-- /storybook-links -->"
/** scripts/showcase-pr.ts's closing marker; this block goes right after it. */
export const SHOWCASE_LINKS_END = "<!-- /showcase-links -->"

/** More components than this are summarised as "and N more". */
export const MAX_COMPONENTS = 20
/** A folder with more stories than this is too broad to match a file by folder alone. */
export const MAX_STORIES_PER_FOLDER = 3

const LINKS_BLOCK = new RegExp(`${LINKS_START}[\\s\\S]*?${LINKS_END}`)

/** A line linking an issue the PR closes, such as `Closes #743`. */
const CLOSING_LINE = /^\s*(close[sd]?|fix(e[sd])?|resolve[sd]?):?\s+([\w.-]+\/[\w.-]+)?#\d+/i

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

/** The block's content: the preview, then the components it changes. */
export function linksBlock(previewUrl: string, components: Component[]): string {
  const base = previewUrl.replace(/\/$/, "")
  const lines = [`**Storybook:** ${base}`]
  if (components.length > 0) {
    lines.push("", "Components this PR changes:")
    for (const { title, id, type } of components.slice(0, MAX_COMPONENTS))
      lines.push(`- [${title}](${base}/?path=/${type}/${id})`)
    const more = components.length - MAX_COMPONENTS
    if (more > 0) lines.push(`- …and ${more} more`)
  }
  return `${LINKS_START}\n${lines.join("\n")}\n${LINKS_END}`
}

/**
 * Replaces the block, or adds it under the showcase links, or at the top under
 * any `Closes #N` lines.
 */
export function withStorybookLinks(body: string, block: string): string {
  if (LINKS_BLOCK.test(body)) return body.replace(LINKS_BLOCK, () => block)
  const showcaseEnd = body.indexOf(SHOWCASE_LINKS_END)
  if (showcaseEnd >= 0) {
    const cut = showcaseEnd + SHOWCASE_LINKS_END.length
    const rest = body.slice(cut).trimStart()
    return `${body.slice(0, cut)}\n\n${block}${rest ? `\n\n${rest}` : "\n"}`
  }
  const lines = body.split("\n")
  let top = 0
  for (let i = 0; i < lines.length; i++) {
    if (CLOSING_LINE.test(lines[i]!)) top = i + 1
    else if (lines[i]!.trim()) break
  }
  const head = lines.slice(0, top).join("\n").trimEnd()
  const rest = lines.slice(top).join("\n").trimStart()
  return [head, block, rest].filter(Boolean).join("\n\n") + (rest ? "" : "\n")
}

/** The workflow's env; not NodeJS.ProcessEnv, which the app's typings narrow. */
export type Env = Record<string, string | undefined>

export interface Deps {
  fetch: typeof fetch
  log: (message: string) => void
  /** Adds to the job summary (GITHUB_STEP_SUMMARY). */
  summary: (markdown: string) => void
  readFile: (path: string) => string
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
    body: async (pr: number) => (await json<{ body: string | null }>(`/pulls/${pr}`)).body ?? "",
    setBody: (pr: number, body: string) =>
      json(`/pulls/${pr}`, { method: "PATCH", body: { body } }),
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
  }
}

async function link(env: Env, deps: Deps): Promise<void> {
  const gh = github(deps, required(env, "GITHUB_REPOSITORY"), required(env, "GITHUB_TOKEN"))
  const pr = Number(required(env, "PR_NUMBER"))
  const index = JSON.parse(deps.readFile(required(env, "INDEX_FILE"))) as {
    entries: Record<string, IndexEntry>
  }
  const components = changedComponents(await gh.files(pr), Object.values(index.entries))
  const block = linksBlock(required(env, "PREVIEW_URL"), components)
  // Read last, so an edit made meanwhile survives.
  const body = await gh.body(pr)
  const next = withStorybookLinks(body, block)
  if (next !== body) await gh.setBody(pr, next)
  deps.log(`Listed the Storybook preview and ${components.length} component(s) in the description.`)
  deps.summary(`### Storybook\n\n${block.split("\n").slice(1, -1).join("\n")}`)
}

const COMMANDS = { link }

export async function main(argv: string[], env: Env, deps: Deps): Promise<number> {
  const command = COMMANDS[argv[0] as keyof typeof COMMANDS]
  if (!command) {
    deps.log("Usage: node scripts/storybook-pr.ts link")
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
  })
}
