/**
 * Drops the databases of closed PRs' previews. Run by dockerfiles/PragmaticPapers.Dockerfile
 * in each preview build, after copy-database.sh, under plain Node 24:
 *
 *   node dockerfiles/scripts/drop-closed-preview-databases.ts
 *
 * Every preview gets its own copy of staging (`<source>_pr_<n>`, see copy-database.sh), and
 * Coolify deletes a closed PR's containers but not that database, so the copies piled up on
 * the database server. A preview build already has what cleaning up needs: a connection to
 * that server as the user that created them.
 *
 * It asks GitHub which PRs are open and drops `<source>_pr_<n>` and `<source>_pr_<n>_incoming`
 * for every other `n`. It never touches any other database, and it's best effort: when it
 * can't tell which PRs are open, it skips, and it never fails the build.
 *
 * GitHub's list can still miss an open PR: one too new to be listed yet, or one that moved
 * between pages while they were read. So a database is also kept while anything is
 * connected to it (a live preview's app usually is), and when its PR is newer than every PR
 * GitHub listed. A later build retries it.
 *
 * A closed PR's preview can also outlive Coolify's delete, and an idle one may hold no
 * connection at the moment of the check. So a database is also kept while its preview's
 * URL still answers as our app, and the log says so: that container needs deleting by hand.
 */
import { pathToFileURL } from "node:url"
import pg from "pg"

type Env = Record<string, string | undefined>

export const DEFAULT_REPOSITORY = "digitalgroundgame/pragmatic-papers"

/** Only what's needed from a `pg.Client`. */
export type PgClient = Pick<pg.Client, "connect" | "query" | "escapeIdentifier" | "end">
export type Fetch = (
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    redirect?: "manual"
    signal?: AbortSignal
  },
) => Promise<Response>

export const DEFAULT_PREVIEW_URL_TEMPLATE = "https://pr-{{pr_id}}.pragmaticpapers.com"

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** The PR a preview database belongs to, or undefined if the name isn't a preview's. */
export function previewPr(database: string, source: string): number | undefined {
  const match = new RegExp(`^${escapeRegExp(source)}_pr_(\\d+)(_incoming)?$`).exec(database)
  return match ? Number(match[1]) : undefined
}

/**
 * The preview databases whose PR isn't open, in name order. A PR newer than every open
 * one GitHub listed may just be too new to be listed, so its database is left alone.
 */
export function closedPreviewDatabases(
  databases: string[],
  source: string,
  openPrs: ReadonlySet<number>,
): string[] {
  const newestOpen = Math.max(...openPrs)
  return databases
    .filter((database) => {
      const pr = previewPr(database, source)
      return pr !== undefined && !openPrs.has(pr) && pr < newestOpen
    })
    .sort()
}

/** The numbers of the repository's open PRs, across every page. */
export async function openPullRequests(
  fetch: Fetch,
  repository: string,
  token?: string,
): Promise<Set<number>> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "pragmatic-papers-preview-build",
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const open = new Set<number>()
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/repos/${repository}/pulls?state=open&per_page=100&page=${page}`
    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`GitHub answered ${response.status} listing open PRs of ${repository}`)
    }
    const pulls = (await response.json()) as { number: number }[]
    for (const pull of pulls) open.add(pull.number)
    if (pulls.length < 100) return open
  }
}

/**
 * Whether PR `pr`'s preview still answers as our app. Asks for a path no page has, so
 * neither Cloudflare's cache nor a page answers: our app replies with its own 404, which
 * carries Next's `X-Powered-By`, and a removed preview gets Coolify's proxy or nothing.
 * Kept in step with `previewAnswers` in scripts/preview-deployment.ts, which this image
 * can't import.
 */
export async function previewAnswers(fetch: Fetch, template: string, pr: number): Promise<boolean> {
  const url = template.replaceAll("{{pr_id}}", String(pr))
  try {
    const response = await fetch(`${url}/__preview-removed-check-${Date.now()}`, {
      method: "HEAD",
      redirect: "manual",
      // A host that never answers counts as gone rather than stalling the caller.
      signal: AbortSignal.timeout(10_000),
    })
    return response.headers.get("x-powered-by")?.includes("Next.js") ?? false
  } catch {
    return false
  }
}

export interface CleanupDeps {
  client: PgClient
  fetch: Fetch
  log(message: string): void
}

/**
 * Drops the closed PRs' preview databases on the server `databaseUri` points at, and
 * returns their names. `source` is the database the previews are copies of, and
 * `currentPr` the PR being built, which must be among the open ones.
 */
export async function dropClosedPreviewDatabases(
  deps: CleanupDeps,
  options: {
    source: string
    currentPr: number
    repository: string
    token?: string
    previewUrlTemplate?: string
  },
): Promise<string[]> {
  const { client, log } = deps
  const openPrs = await openPullRequests(deps.fetch, options.repository, options.token)
  // The PR being built is open by definition. If GitHub's list doesn't include it, the
  // list is wrong (the wrong repository, say), and every preview would look closed.
  if (!openPrs.has(options.currentPr)) {
    log(
      `PR ${options.currentPr} isn't among ${options.repository}'s ${openPrs.size} open PRs; ` +
        "not trusting the list, skipping cleanup",
    )
    return []
  }

  const { rows } = await client.query<{ datname: string }>(
    "SELECT datname FROM pg_database WHERE datname LIKE $1",
    [`${options.source.replace(/[\\%_]/g, "\\$&")}\\_pr\\_%`],
  )
  const closed = closedPreviewDatabases(
    rows.map((row) => row.datname),
    options.source,
    openPrs,
  )
  if (!closed.length) {
    log("No closed PRs' preview databases to drop")
    return []
  }

  // Anything connected means the database may still be in use: a live preview whose PR
  // GitHub's list missed. Leave it; a later build retries once it's idle. Without
  // disconnecting anyone, a client that connects after this check makes the DROP fail,
  // which is logged below.
  const { rows: active } = await client.query<{ datname: string }>(
    "SELECT DISTINCT datname FROM pg_stat_activity WHERE datname = ANY($1)",
    [closed],
  )
  const inUse = new Set(active.map((row) => row.datname))

  const dropped: string[] = []
  for (const database of closed) {
    if (inUse.has(database)) {
      log(`Keeping ${database}: something is still connected to it`)
      continue
    }
    const pr = previewPr(database, options.source)!
    const template = options.previewUrlTemplate ?? DEFAULT_PREVIEW_URL_TEMPLATE
    if (await previewAnswers(deps.fetch, template, pr)) {
      log(
        `Keeping ${database}: PR ${pr} is closed but its preview still answers. ` +
          "Delete that preview in Coolify.",
      )
      continue
    }
    try {
      await client.query(`DROP DATABASE IF EXISTS ${client.escapeIdentifier(database)}`)
      dropped.push(database)
      log(`Dropped ${database}`)
    } catch (error) {
      log(`Couldn't drop ${database}: ${(error as Error).message}`)
    }
  }
  return dropped
}

/** The PR a preview build is for, from the database copy-database.sh just made. */
function currentPr(databaseUri: string, source: string): number | undefined {
  const database = decodeURIComponent(new URL(databaseUri).pathname.slice(1))
  return previewPr(database, source)
}

export async function main(
  env: Env = process.env,
  overrides: Partial<Pick<CleanupDeps, "fetch" | "log">> & { client?: PgClient } = {},
): Promise<number> {
  const log = overrides.log ?? ((message: string) => process.stdout.write(`${message}\n`))
  log("--- Dropping closed PRs' preview databases ---")
  const source = env.SOURCE_DATABASE_NAME
  if (env.COPY_SOURCE_DATABASE !== "true" || !source || !env.DATABASE_URI) {
    log("Not a preview build with a database copy; nothing to clean up")
    return 0
  }
  let client: PgClient | undefined
  try {
    const pr = currentPr(env.DATABASE_URI, source)
    if (pr === undefined) {
      log("DATABASE_URI isn't a preview database; skipping cleanup")
      return 0
    }
    const admin = new URL(env.DATABASE_URI)
    admin.pathname = "/postgres"
    client = overrides.client ?? new pg.Client({ connectionString: admin.toString() })
    await client.connect()
    await dropClosedPreviewDatabases(
      { client, fetch: overrides.fetch ?? fetch, log },
      {
        source,
        currentPr: pr,
        repository: env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY,
        token: env.GITHUB_TOKEN || undefined,
        previewUrlTemplate: env.PREVIEW_URL_TEMPLATE || undefined,
      },
    )
  } catch (error) {
    // Best effort: a failed cleanup mustn't fail the build. pg and fetch errors name
    // hosts, never passwords.
    log(`Skipping cleanup: ${(error as Error).message}`)
  } finally {
    await client?.end().catch(() => undefined)
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
