// The throwaway Postgres that integration tests, E2E tests and the pending-migrations
// check run against. One helper decides where tests run, so none of them
// reads DATABASE_URI: that variable names the dev database in `.env`, and a test that
// trusted it would migrate, seed and litter the dev cluster. Callers only *set*
// DATABASE_URI, for the Payload processes they start.
//
// - TEST_DATABASE_URI set: use that database as-is (CI's E2E jobs, which run inside a
//   container that can't publish ports, point it at the job's `postgres` service).
// - Otherwise: `docker run` a postgres:17-alpine container on a random localhost port,
//   removed on exit, Ctrl-C or SIGTERM. A container whose owner was killed outright is
//   swept by the next run.
//
// With `snapshot: true` (and outside CI), the migrated database is committed to a local
// image keyed on src/migrations and the Postgres image, so the next run starts it and
// skips `payload migrate`, which spends ~9s just booting Payload. CI always migrates a
// fresh database, so a stale local snapshot can never hide a migration bug there.

/* eslint-disable @typescript-eslint/explicit-module-boundary-types -- typed with JSDoc */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { hostname } from "node:os"
import path from "node:path"
import { parse } from "dotenv"

// Docker Hub's official image, through Amazon ECR Public's mirror of it: Docker Hub
// rate-limits anonymous pulls by address, and CI's shared runners run out.
// CI sets TEST_DB_IMAGE to its copy in GHCR, which it pulls logged in.
export const BASE_IMAGE =
  process.env.TEST_DB_IMAGE || "public.ecr.aws/docker/library/postgres:17-alpine"
export const SNAPSHOT_REPO = "pragmatic-papers-test-db"
export const OWNER_LABEL = "pragmatic-papers.test-db.owner"
export const DATABASE = "pragmatic-papers-test"
const USER = "postgres"
const PASSWORD = "postgres"
// Outside the image's VOLUME (/var/lib/postgresql/data), so `docker commit` captures it.
const PGDATA = "/pgdata"
// Bump to invalidate every snapshot when how one is built changes.
const SNAPSHOT_FORMAT = "1"
// Snapshots kept besides the current one, for worktrees on branches with other migrations.
const SNAPSHOTS_KEPT = 2
const MIGRATIONS_DIR = "src/migrations"

/**
 * @param {string[]} args
 * @returns {string}
 */
const defaultDocker = (args) =>
  execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

/**
 * Host, port and database name, with every loopback spelling counted as one host.
 * @param {string} uri
 */
function target(uri) {
  const url = new URL(uri)
  const host = LOCAL_HOSTS.has(url.hostname) ? "localhost" : url.hostname
  return `${host}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`
}

/**
 * Refuses a test database that is the dev database `.env` names: the suites create
 * databases in it, migrate it and seed it.
 * @param {string} uri
 * @param {string | undefined} devUri
 */
export function assertNotDevDatabase(uri, devUri) {
  let candidate
  try {
    candidate = target(uri)
  } catch {
    throw new Error(`TEST_DATABASE_URI isn't a valid connection string.`)
  }
  if (!devUri) return
  let dev
  try {
    dev = target(devUri)
  } catch {
    return
  }
  if (candidate === dev) {
    throw new Error(
      `Refusing to run tests against ${dev}: it is the DATABASE_URI in .env, your dev ` +
        `database, and the tests migrate, seed and create databases in it. Point ` +
        `TEST_DATABASE_URI at a throwaway database, or unset it to start one in Docker.`,
    )
  }
}

/** The DATABASE_URI in `.env`, read from the file, never from the environment. */
function devDatabaseUri() {
  if (!existsSync(".env")) return undefined
  return parse(readFileSync(".env")).DATABASE_URI
}

/**
 * Names the snapshot for these migrations on this Postgres image.
 * @param {{ baseImageId: string, migrationsDir?: string }} options
 */
export function snapshotTag({ baseImageId, migrationsDir = MIGRATIONS_DIR }) {
  const hash = createHash("sha256")
  hash.update(`${SNAPSHOT_FORMAT}\0${baseImageId}\0${DATABASE}\0`)
  const files = readdirSync(migrationsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
  for (const file of files) {
    hash.update(`${path.relative(migrationsDir, file)}\0`)
    hash.update(readFileSync(file))
    hash.update("\0")
  }
  return `${SNAPSHOT_REPO}:${hash.digest("hex").slice(0, 16)}`
}

/** @param {number} pid */
function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === "EPERM"
  }
}

/**
 * Removes test databases whose owning process on this machine is gone: what a
 * `kill -9`, a crash or a closed terminal left behind.
 * @param {{ docker?: (args: string[]) => string, host?: string, alive?: (pid: number) => boolean }} [options]
 * @returns {string[]} the containers removed
 */
export function sweepOrphans({ docker = defaultDocker, host = hostname(), alive = isAlive } = {}) {
  const rows = docker([
    "ps",
    "-a",
    "--filter",
    `label=${OWNER_LABEL}`,
    "--format",
    `{{.ID}} {{.Label "${OWNER_LABEL}"}}`,
  ])
  const removed = []
  for (const row of rows.split("\n").filter(Boolean)) {
    const [id, owner = ""] = row.split(" ")
    const separator = owner.lastIndexOf(":")
    const ownerHost = owner.slice(0, separator)
    const pid = Number(owner.slice(separator + 1))
    if (!id || ownerHost !== host || !Number.isInteger(pid) || alive(pid)) continue
    try {
      docker(["rm", "-f", id])
      removed.push(id)
    } catch {
      // Already gone, or removed by a concurrent run's sweep.
    }
  }
  return removed
}

/**
 * Removes all but the newest snapshots, keeping `current`.
 * @param {string} current
 * @param {{ docker?: (args: string[]) => string }} [options]
 */
export function pruneSnapshots(current, { docker = defaultDocker } = {}) {
  // `docker image ls` lists newest first.
  const tags = docker(["image", "ls", SNAPSHOT_REPO, "--format", "{{.Repository}}:{{.Tag}}"])
    .split("\n")
    .filter((tag) => tag && tag !== current)
  for (const tag of tags.slice(SNAPSHOTS_KEPT)) {
    try {
      docker(["rmi", tag])
    } catch {
      // In use by another worktree's container; the next prune gets it.
    }
  }
}

/**
 * @param {(args: string[]) => string} docker
 * @param {string} image
 * @param {{ remove: boolean }} options
 */
function runContainer(docker, image, { remove }) {
  return docker([
    "run",
    "-d",
    ...(remove ? ["--rm"] : []),
    "-p",
    "127.0.0.1::5432",
    "--label",
    `${OWNER_LABEL}=${hostname()}:${process.pid}`,
    "-e",
    `POSTGRES_USER=${USER}`,
    "-e",
    `POSTGRES_PASSWORD=${PASSWORD}`,
    "-e",
    `POSTGRES_DB=${DATABASE}`,
    "-e",
    `PGDATA=${PGDATA}`,
    image,
  ])
}

/**
 * Waits for the real server: over TCP, since the image's init script runs a temporary
 * server on the Unix socket only, which `pg_isready` without `-h` would accept.
 * @param {(args: string[]) => string} docker
 * @param {string} id
 */
async function waitForPostgres(docker, id, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      docker(["exec", id, "pg_isready", "-h", "127.0.0.1", "-U", USER, "-d", DATABASE])
      return
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`Postgres in container ${id.slice(0, 12)} didn't become ready`, {
          cause: error,
        })
      }
      await sleep(200)
    }
  }
}

/**
 * @param {(args: string[]) => string} docker
 * @param {string} id
 */
function connectionUri(docker, id) {
  const mapping = docker(["port", id, "5432/tcp"]).split("\n")[0] ?? ""
  const port = mapping.slice(mapping.lastIndexOf(":") + 1)
  return `postgres://${USER}:${PASSWORD}@127.0.0.1:${port}/${DATABASE}`
}

/**
 * Removes the container when this process ends, however it ends short of SIGKILL.
 * @param {() => void} stop
 * @returns {() => void} unregisters the handlers
 */
function stopOnExit(stop) {
  /** @type {Map<NodeJS.Signals, () => void>} */
  const handlers = new Map()
  const unregister = () => {
    process.off("exit", stop)
    for (const [signal, handler] of handlers) process.off(signal, handler)
  }
  for (const signal of /** @type {const} */ (["SIGINT", "SIGTERM", "SIGHUP"])) {
    const handler = () => {
      stop()
      // Alone, this listener would swallow the signal; re-raise it so the process still
      // ends. When something else listens (Vitest does), leave the exit to it.
      if (process.listenerCount(signal) === 1) {
        unregister()
        process.kill(process.pid, signal)
      }
    }
    handlers.set(signal, handler)
    process.on(signal, handler)
  }
  process.on("exit", stop)
  return unregister
}

/**
 * @typedef {object} TestDatabase
 * @property {string} uri Connection string for the test database.
 * @property {boolean} fromSnapshot Whether it started already migrated.
 * @property {() => void} stop Removes the container (a no-op for TEST_DATABASE_URI).
 */

/**
 * Starts (or picks) the test database and brings it to the latest migration.
 *
 * @param {object} options
 * @param {(uri: string) => void} options.migrate Runs the migrations against `uri`; skipped
 *   when a snapshot already holds them.
 * @param {boolean} [options.snapshot] Reuse a pre-migrated snapshot image (ignored in CI).
 * @param {(message: string) => void} [options.log]
 * @param {(args: string[]) => string} [options.docker]
 * @param {Record<string, string | undefined>} [options.env]
 * @returns {Promise<TestDatabase>}
 */
export async function startTestDatabase({
  migrate,
  snapshot = false,
  log = console.warn,
  docker = defaultDocker,
  env = process.env,
}) {
  const external = env.TEST_DATABASE_URI
  if (external) {
    assertNotDevDatabase(external, devDatabaseUri())
    log(`Using TEST_DATABASE_URI (${target(external)}).`)
    migrate(external)
    return { uri: external, fromSnapshot: false, stop: () => undefined }
  }

  for (const id of sweepOrphans({ docker })) {
    log(`Removed test database ${id.slice(0, 12)}, left by a run that was killed.`)
  }

  const useSnapshot = snapshot && !env.CI
  let tag = null
  if (useSnapshot) {
    try {
      docker(["image", "inspect", BASE_IMAGE])
    } catch {
      log(`Pulling ${BASE_IMAGE}...`)
      docker(["pull", BASE_IMAGE])
    }
    tag = snapshotTag({ baseImageId: docker(["image", "inspect", "-f", "{{.Id}}", BASE_IMAGE]) })
  }

  let hit = false
  if (tag) {
    try {
      docker(["image", "inspect", tag])
      hit = true
    } catch {
      // No snapshot for these migrations yet.
    }
  }

  /** @type {string | null} */
  let id = null
  const stop = () => {
    if (!id) return
    const container = id
    id = null
    try {
      docker(["rm", "-f", "-v", container])
    } catch {
      // Already gone.
    }
  }
  const unregister = stopOnExit(stop)
  const release = () => {
    stop()
    unregister()
  }

  try {
    if (hit && tag) {
      id = runContainer(docker, tag, { remove: true })
      await waitForPostgres(docker, id)
      log(`Test database started from snapshot ${tag}; migrations already applied.`)
      return { uri: connectionUri(docker, id), fromSnapshot: true, stop: release }
    }

    // Kept on stop (no --rm) when it will be committed, so it can be stopped cleanly first.
    id = runContainer(docker, BASE_IMAGE, { remove: !tag })
    await waitForPostgres(docker, id)
    const uri = connectionUri(docker, id)
    log(`Test database started at ${uri}`)
    migrate(uri)

    if (!tag) return { uri, fromSnapshot: false, stop: release }

    log(`Saving the migrated database as ${tag}...`)
    docker(["stop", id])
    docker(["commit", id, tag])
    stop()
    pruneSnapshots(tag, { docker })
    id = runContainer(docker, tag, { remove: true })
    await waitForPostgres(docker, id)
    return { uri: connectionUri(docker, id), fromSnapshot: false, stop: release }
  } catch (error) {
    release()
    throw error
  }
}
