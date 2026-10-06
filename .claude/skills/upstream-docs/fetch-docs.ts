/**
 * Fetches a third-party project's documentation source into .cache/upstream-docs/<source>,
 * so it can be searched and read locally. Used by the upstream-docs skill: cloud agent
 * sessions can't reach most documentation sites, but they can clone public GitHub repos.
 *
 *   pnpm tsx .claude/skills/upstream-docs/fetch-docs.ts list
 *   pnpm tsx .claude/skills/upstream-docs/fetch-docs.ts <source> [path...] [--refresh]
 *
 * The first fetch is a shallow, blobless, sparse clone of the source's default paths. Extra
 * paths (relative to the repo root) are added to the checkout. A later fetch reuses the
 * clone as it is; --refresh moves it to the branch's newest commit. A source pinned to an
 * installed package (Payload) is fetched at that package's release tag instead, and
 * refetched when the installed version changes. Prints the directory and the commit, which
 * is what to cite when quoting the docs.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export interface Source {
  /** GitHub `owner/repo` (the wiki's is `owner/repo.wiki`). */
  repo: string
  branch: string
  /**
   * An npm package whose installed version picks the docs: they're fetched at its release
   * tag (`v<version>`), so they describe the version we run rather than upstream's newest.
   */
  pinTo?: string
  /** Sparse-checkout paths fetched by default. Empty checks out the whole repo. */
  paths: string[]
  /** The site these files are published as, for citing a page to a person. */
  site: string
  summary: string
}

export const SOURCES: Record<string, Source> = {
  payload: {
    repo: "payloadcms/payload",
    branch: "main",
    pinTo: "payload",
    paths: ["docs"],
    site: "https://payloadcms.com/docs",
    summary:
      "Payload CMS: collections, fields, hooks, access, Lexical rich text, Postgres adapter, jobs",
  },
  coolify: {
    repo: "coollabsio/coolify-docs",
    branch: "main",
    paths: ["content/docs"],
    site: "https://coolify.io/docs",
    summary: "Coolify: builds, environment variables and build secrets, previews, Docker cleanup",
  },
  github: {
    repo: "github/docs",
    branch: "main",
    paths: [
      "content/actions",
      "content/rest",
      "content/issues",
      "content/pull-requests",
      "content/repositories",
      "content/webhooks",
      "content/communities",
      "data/reusables/actions",
    ],
    site: "https://docs.github.com",
    summary: "GitHub: Actions, REST API guides, issues and Projects, PRs, repositories, webhooks",
  },
  cloudflare: {
    repo: "cloudflare/cloudflare-docs",
    branch: "production",
    paths: [
      "turnstile",
      "cache",
      "rules",
      "dns",
      "ssl",
      "web-analytics",
      "waf",
      "fundamentals",
    ].flatMap((product) => [`src/content/docs/${product}`, `src/content/partials/${product}`]),
    site: "https://developers.cloudflare.com",
    summary: "Cloudflare: Turnstile, cache and rules, DNS, SSL, Web Analytics (RUM), WAF",
  },
  sentry: {
    repo: "getsentry/sentry-docs",
    branch: "master",
    paths: [
      "docs/platforms/javascript/common",
      "docs/platforms/javascript/guides/nextjs",
      "includes",
    ],
    site: "https://docs.sentry.io",
    summary: "Sentry for Next.js: setup, filtering, sampling, source maps, releases",
  },
  wiki: {
    repo: "digitalgroundgame/pragmatic-papers.wiki",
    branch: "master",
    paths: [],
    site: "https://github.com/digitalgroundgame/pragmatic-papers/wiki",
    summary: "This repo's wiki: architecture, environments, releases, contributing",
  },
}

const ROOT = resolve(import.meta.dirname, "../../..")
export const CACHE_DIR = join(ROOT, ".cache/upstream-docs")

function installedVersion(pkg: string): string {
  // package.json isn't always in a package's exports, so read the file directly.
  const path = join(ROOT, "node_modules", pkg, "package.json")
  return (JSON.parse(readFileSync(path, "utf-8")) as { version: string }).version
}

/** The branch or tag to fetch: the pinned package's release tag, or the source's branch. */
export function refFor(source: Source, readVersion = installedVersion): string {
  return source.pinTo ? `v${readVersion(source.pinTo)}` : source.branch
}

export interface Options {
  source: string
  paths: string[]
  refresh: boolean
}

export function parseArgs(args: string[]): Options | "list" {
  const [source, ...rest] = args
  if (!source || source === "list") return "list"
  if (!(source in SOURCES)) {
    throw new Error(`Unknown source "${source}". Sources: ${Object.keys(SOURCES).join(", ")}`)
  }
  const paths = rest.filter((arg) => arg !== "--refresh")
  for (const path of paths) {
    if (path.startsWith("/") || path.startsWith("-") || path.split("/").includes("..")) {
      throw new Error(`Not a path inside the repo: ${path}`)
    }
  }
  return { source, paths, refresh: rest.includes("--refresh") }
}

/** What's already in the cache for a source: nothing, or a clone of `ref`. */
export type Cached = { ref: string } | null

/** The git commands that bring `dir` to `ref` plus what `options` asks for. */
export function plan(options: Options, dir: string, ref: string, cached: Cached): string[][] {
  const source = SOURCES[options.source]!
  const sparse = source.paths.length > 0
  const commands: string[][] = []
  if (!cached) {
    commands.push([
      "-c",
      "advice.detachedHead=false",
      "clone",
      "--quiet",
      "--depth=1",
      "--filter=blob:none",
      ...(sparse ? ["--sparse"] : []),
      `--branch=${ref}`,
      `https://github.com/${source.repo}.git`,
      dir,
    ])
    if (sparse) commands.push(["-C", dir, "sparse-checkout", "set", ...source.paths])
  } else if (options.refresh || cached.ref !== ref) {
    commands.push(["-C", dir, "fetch", "--quiet", "--depth=1", "origin", ref])
    commands.push(["-C", dir, "reset", "--quiet", "--hard", "FETCH_HEAD"])
  }
  // Remembered in the clone's own config, so a version change is noticed next time.
  if (!cached || cached.ref !== ref) commands.push(["-C", dir, "config", "upstream-docs.ref", ref])
  if (sparse && options.paths.length) {
    commands.push(["-C", dir, "sparse-checkout", "add", ...options.paths])
  }
  return commands
}

function readCached(dir: string, source: Source): Cached {
  if (!existsSync(join(dir, ".git"))) return null
  try {
    const ref = execFileSync("git", ["-C", dir, "config", "upstream-docs.ref"], {
      encoding: "utf-8",
    })
    return { ref: ref.trim() }
  } catch {
    return { ref: source.branch }
  }
}

export function main(args: string[]): number {
  try {
    const options = parseArgs(args)
    if (options === "list") {
      for (const [name, source] of Object.entries(SOURCES)) {
        console.warn(`${name.padEnd(11)} ${source.summary}\n${"".padEnd(11)} ${source.site}`)
      }
      return 0
    }
    const source = SOURCES[options.source]!
    const dir = join(CACHE_DIR, options.source)
    const ref = refFor(source)
    mkdirSync(CACHE_DIR, { recursive: true })
    for (const command of plan(options, dir, ref, readCached(dir, source))) {
      execFileSync("git", command, { stdio: ["ignore", "ignore", "inherit"] })
    }
    const commit = execFileSync("git", ["-C", dir, "log", "-1", "--format=%H %cs"], {
      encoding: "utf-8",
    }).trim()
    // stdout carries only the directory, so a caller can do `cd "$(… fetch-docs.ts payload)"`.
    console.warn(`${options.source} at ${ref} (${commit})`)
    process.stdout.write(`${dir}\n`)
    return 0
  } catch (error) {
    console.error(`ERROR: ${(error as Error).message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
