/**
 * Prepares the database a build migrates and then serves. Run by
 * dockerfiles/PragmaticPapers.Dockerfile under plain Node 24, before `payload migrate`:
 *
 *   node dockerfiles/scripts/preview-database.ts
 *
 * 1. Resolves DATABASE_URI. A preview (BUILD_ENV=preview) gets its own database, named
 *    after its host: COOLIFY_FQDN=pr-748.pragmaticpapers.com turns `…/pragmatic_papers`
 *    into `…/pragmatic_papers_pr_748`. The result goes to /tmp/database_uri.env, which
 *    the later RUN steps source and the runner stage copies.
 * 2. With COPY_SOURCE_DATABASE=true, creates that database as a copy of
 *    SOURCE_DATABASE_URI (staging), unless it already exists. FORCE_DATABASE_COPY=true
 *    replaces an existing copy.
 *
 * Two rules keep a preview build from disturbing anything that's serving traffic:
 *
 * - The source's connections are never terminated. Killing staging's pool failed
 *   whatever staging was serving (#1057). A template copy needs the source to have no
 *   connections, so it's only tried as the fast path; while staging's app is connected
 *   Postgres refuses it and the copy falls back to pg_dump | pg_restore.
 * - A forced copy is built and migrated beside the live one, as `<target>_incoming`, and
 *   swapped in only once it's ready. Dropping the target first left the previous
 *   deploy's container on a missing, then unmigrated, database (#1058).
 */
import { spawn, spawnSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { setTimeout as sleep } from "node:timers/promises"
import { pathToFileURL } from "node:url"
import pg from "pg"

export const ENV_FILE = "/tmp/database_uri.env"

/** Postgres truncates longer identifiers, which would silently merge two previews' databases. */
const MAX_IDENTIFIER_BYTES = 63

/** SQLSTATE object_in_use: a template or a database being dropped still has clients. */
const OBJECT_IN_USE = "55006"

type Env = Record<string, string | undefined>

/** The URI with its password replaced, for logs. */
export function maskUri(uri: string): string {
  try {
    const url = new URL(uri)
    if (url.password) url.password = "****"
    return url.toString()
  } catch {
    return "<unparseable URI>"
  }
}

function parse(uri: string): URL {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    throw new Error(`Not a valid PostgreSQL URI: ${maskUri(uri)}`)
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`Not a PostgreSQL URI (expected postgres:// or postgresql://): ${maskUri(uri)}`)
  }
  return url
}

export function databaseName(uri: string): string {
  const name = decodeURIComponent(parse(uri).pathname.replace(/^\//, ""))
  if (!name) throw new Error(`No database name in ${maskUri(uri)}`)
  return name
}

/** The same server, credentials and parameters (e.g. `?sslmode=`), pointed at another database. */
export function withDatabase(uri: string, name: string): string {
  const url = parse(uri)
  url.pathname = `/${encodeURIComponent(name)}`
  return url.toString()
}

export function sameServer(a: string, b: string): boolean {
  const [x, y] = [parse(a), parse(b)]
  return x.hostname === y.hostname && (x.port || "5432") === (y.port || "5432")
}

/**
 * The DATABASE_URI this build uses. Outside previews it's DATABASE_URI unchanged. A
 * preview without COOLIFY_FQDN fails: falling back to DATABASE_URI would migrate and
 * serve the database every preview shares, with this branch's migrations (#1058).
 */
export function resolveDatabaseUri(env: Env): string {
  const uri = env.DATABASE_URI
  if (!uri) throw new Error("DATABASE_URI is not set")
  if (env.BUILD_ENV !== "preview") return uri

  if (!env.COOLIFY_FQDN) {
    throw new Error(
      "COOLIFY_FQDN is not set, so this preview can't get its own database. " +
        "Refusing to build against the shared DATABASE_URI.",
    )
  }
  const suffix = env.COOLIFY_FQDN.split(".")[0]!.replaceAll("-", "_")
  const name = `${databaseName(uri)}_${suffix}`
  if (Buffer.byteLength(name) > MAX_IDENTIFIER_BYTES) {
    throw new Error(`Preview database name "${name}" is longer than Postgres allows`)
  }
  return withDatabase(uri, name)
}

/** A shell line exporting the URI, quoted so no character in it can break out. */
export function envFileLine(uri: string): string {
  return `export DATABASE_URI='${uri.replaceAll("'", `'\\''`)}'\n`
}

/** What copyDatabase needs from the target server. */
export interface Server {
  exists(db: string): Promise<boolean>
  /** Resolves "busy" when Postgres refuses because the template has clients. */
  createFromTemplate(db: string, template: string): Promise<"copied" | "busy">
  create(db: string): Promise<void>
  /** Disconnects the database's clients and drops it. */
  drop(db: string): Promise<void>
  rename(from: string, to: string): Promise<void>
}

export interface CopyDeps {
  server: Server
  dumpRestore(sourceUri: string, targetUri: string): Promise<void>
  migrate(uri: string): Promise<void>
  log(message: string): void
}

export interface CopyOptions {
  sourceUri: string
  targetUri: string
  force: boolean
}

export async function copyDatabase(deps: CopyDeps, options: CopyOptions): Promise<void> {
  const { server, log } = deps
  const { sourceUri, targetUri, force } = options
  const source = databaseName(sourceUri)
  const target = databaseName(targetUri)

  if (sameServer(sourceUri, targetUri) && source === target) {
    log(`Source and target are the same database (${source}); skipping the copy`)
    return
  }

  const copyInto = async (db: string): Promise<void> => {
    if (sameServer(sourceUri, targetUri)) {
      log(`Trying a template copy of "${source}" into "${db}"...`)
      if ((await server.createFromTemplate(db, source)) === "copied") {
        log("Copied with CREATE DATABASE … TEMPLATE")
        return
      }
      log(`"${source}" is in use, so it can't be a template; falling back to dump/restore`)
    }
    log(`Copying "${source}" into "${db}" with pg_dump | pg_restore...`)
    await server.create(db)
    try {
      await deps.dumpRestore(sourceUri, withDatabase(targetUri, db))
    } catch (error) {
      // Left behind, the half-restored database would "exist" to the next build, which
      // would then keep it instead of copying.
      await server.drop(db)
      throw error
    }
    log("Copied with pg_dump | pg_restore")
  }

  if (!(await server.exists(target))) {
    await copyInto(target)
    return
  }
  if (!force) {
    log(`"${target}" already exists and FORCE_DATABASE_COPY isn't true; keeping it`)
    return
  }

  const incoming = `${target}_incoming`
  if (Buffer.byteLength(incoming) > MAX_IDENTIFIER_BYTES) {
    throw new Error(`Staging database name "${incoming}" is longer than Postgres allows`)
  }
  log(`"${target}" exists and FORCE_DATABASE_COPY=true; preparing a fresh copy in "${incoming}"`)
  await server.drop(incoming)
  await copyInto(incoming)
  log(`Migrating "${incoming}"...`)
  await deps.migrate(withDatabase(targetUri, incoming))
  log(`Swapping "${incoming}" in for "${target}"...`)
  await server.drop(target)
  await server.rename(incoming, target)
}

function isObjectInUse(error: unknown): boolean {
  return (error as { code?: string }).code === OBJECT_IN_USE
}

/** The part of a `pg.Client` that pgServer uses. */
export type PgClient = Pick<pg.Client, "connect" | "query" | "escapeIdentifier" | "end">

export interface PgServerOptions {
  /** Defaults to a client for the target server's `postgres` database. */
  client?: PgClient
  /** Wait between attempts to drop a database a client reconnected to. */
  retryDelayMs?: number
}

/** A Server over one connection to the target server's `postgres` database. */
export async function pgServer(
  targetUri: string,
  {
    client = new pg.Client({ connectionString: withDatabase(targetUri, "postgres") }),
    retryDelayMs = 1000,
  }: PgServerOptions = {},
): Promise<Server & { close(): Promise<void> }> {
  await client.connect()
  const id = (name: string): string => client.escapeIdentifier(name)

  return {
    async exists(db) {
      const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db])
      return rowCount === 1
    },
    async createFromTemplate(db, template) {
      try {
        await client.query(`CREATE DATABASE ${id(db)} TEMPLATE ${id(template)}`)
        return "copied"
      } catch (error) {
        if (isObjectInUse(error)) return "busy"
        throw error
      }
    },
    async create(db) {
      await client.query(`CREATE DATABASE ${id(db)}`)
    },
    async drop(db) {
      // A pool can reconnect between the terminate and the drop, so retry a few times.
      for (let attempt = 1; ; attempt++) {
        await client.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [db],
        )
        try {
          await client.query(`DROP DATABASE IF EXISTS ${id(db)}`)
          return
        } catch (error) {
          if (!isObjectInUse(error) || attempt === 5) throw error
          await sleep(retryDelayMs)
        }
      }
    },
    async rename(from, to) {
      await client.query(`ALTER DATABASE ${id(from)} RENAME TO ${id(to)}`)
    },
    async close() {
      await client.end()
    },
  }
}

/** pg_dump the source straight into pg_restore, failing if either side fails. */
export function dumpRestore(sourceUri: string, targetUri: string): Promise<void> {
  const flags = ["--format=custom", "--no-owner", "--no-acl"]
  const dump = spawn("pg_dump", [...flags, `--dbname=${sourceUri}`], {
    stdio: ["ignore", "pipe", "inherit"],
  })
  const restore = spawn("pg_restore", ["--no-owner", "--no-acl", `--dbname=${targetUri}`], {
    stdio: ["pipe", "inherit", "inherit"],
  })
  dump.stdout.pipe(restore.stdin)
  // When pg_restore quits early, pg_dump's next write fails with EPIPE. Unhandled, that
  // crashes the process before copyDatabase can drop the half-restored database; the exit
  // codes below already report the failure.
  restore.stdin.on("error", () => undefined)

  const exit = (name: string, child: ReturnType<typeof spawn>) =>
    new Promise<void>((resolve, reject) => {
      child.on("error", reject)
      child.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`${name} exited with ${code}`)),
      )
    })
  return Promise.all([exit("pg_dump", dump), exit("pg_restore", restore)]).then(() => undefined)
}

/** `payload migrate` against `uri`, failing if it does. */
export function migrate(uri: string): Promise<void> {
  const result = spawnSync("pnpm", ["payload", "migrate"], {
    env: { ...process.env, DATABASE_URI: uri },
    stdio: "inherit",
  })
  if (result.status !== 0) {
    return Promise.reject(new Error(`payload migrate exited with ${result.status}`))
  }
  return Promise.resolve()
}

/** What main reaches outside the process through, replaceable in tests. */
export interface MainDeps {
  connect(targetUri: string): Promise<Server & { close(): Promise<void> }>
  dumpRestore: CopyDeps["dumpRestore"]
  migrate: CopyDeps["migrate"]
}

const defaultDeps: MainDeps = { connect: (uri) => pgServer(uri), dumpRestore, migrate }

export async function main(
  env: Env = process.env,
  envFile = ENV_FILE,
  overrides: Partial<MainDeps> = {},
): Promise<number> {
  const deps = { ...defaultDeps, ...overrides }
  const log = (message: string) => process.stdout.write(`${message}\n`)
  try {
    const uri = resolveDatabaseUri(env)
    log(`DATABASE_URI: ${maskUri(uri)}`)
    writeFileSync(envFile, envFileLine(uri))

    if (env.COPY_SOURCE_DATABASE !== "true") {
      log("COPY_SOURCE_DATABASE isn't true; not copying a database")
      return 0
    }
    if (!env.SOURCE_DATABASE_URI) throw new Error("SOURCE_DATABASE_URI is not set")
    log(`Copying from ${maskUri(env.SOURCE_DATABASE_URI)}`)

    const server = await deps.connect(uri)
    try {
      await copyDatabase(
        { server, dumpRestore: deps.dumpRestore, migrate: deps.migrate, log },
        {
          sourceUri: env.SOURCE_DATABASE_URI,
          targetUri: uri,
          force: env.FORCE_DATABASE_COPY === "true",
        },
      )
    } finally {
      await server.close()
    }
    log("Database ready")
    return 0
  } catch (error) {
    console.error(`ERROR: ${(error as Error).message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
