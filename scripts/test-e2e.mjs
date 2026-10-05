import { execFileSync, execSync, spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lookup } from "node:dns/promises"
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import pg from "pg"
import { blue, green, red } from "./ansi.mjs"
import { startTestDatabase } from "./test-db.mjs"

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => {
      resolve(false)
    })
  })
}

const SCREENSHOTS_DIR = "tests/e2e/__screenshots__"

// Content hash of every baseline, so "did this run write one?" needs no repo:
// in the Docker container a worktree's .git points outside the mount, and the
// container runs as root over files the host owns.
function screenshotFingerprint() {
  if (!existsSync(SCREENSHOTS_DIR)) return ""
  return readdirSync(SCREENSHOTS_DIR, { recursive: true })
    .filter((file) => file.endsWith(".png"))
    .sort()
    .map((file) => {
      const hash = createHash("sha1").update(readFileSync(path.join(SCREENSHOTS_DIR, file)))
      return `${file} ${hash.digest("hex")}`
    })
    .join("\n")
}

process.env.PAYLOAD_SECRET ||= "test-secret-for-e2e-tests"
process.env.USE_LOCAL_STORAGE ||= "true"
process.env.PORT ||= "8000"
process.env.SERVER_URL ||= `http://localhost:${process.env.PORT}`
process.env.PAYLOAD_CONFIG_PATH ||= "src/payload.config.ts"
process.env.E2E_MANAGED_SERVER = "true"

// Checked before the database starts, so a busy port leaves nothing to clean up.
const port = Number(process.env.PORT)
if (await isPortInUse(port)) {
  console.error(
    `${red("✖")} Port ${port} is already in use. ` +
      `Stop the process bound to it (e.g. \`lsof -ti:${port} | xargs kill\`) before running E2E tests.`,
  )
  process.exit(1)
}

console.warn(`${blue("●")} Starting the test database...`)
// A snapshot image skips `payload migrate` while the migrations are unchanged
// (scripts/test-db.mjs). The seed below writes to this run's container only.
const database = await startTestDatabase({
  snapshot: true,
  migrate: (uri) => {
    console.warn(`${blue("●")} Running database migrations...`)
    execSync("pnpm payload migrate", {
      env: { ...process.env, DATABASE_URI: uri },
      stdio: "inherit",
    })
  },
})
// Set, never read: every Payload process this script starts (the seed, the server)
// inherits it in place of the dev database `.env` names.
process.env.DATABASE_URI = database.uri
console.warn(`${green("✔")} Test database ready.`)

// A production server (`next build` + `next start`) renders deterministically —
// no dev overlay, no on-demand compilation, no hot-reload artifacts — so CI
// uses it for stable screenshots. Local runs default to the faster dev server.
const useProdServer = !!process.env.E2E_PROD_SERVER

// CI tests the image it deploys: E2E_IMAGE names it, already loaded into Docker,
// and E2E_NETWORK_CONTAINER the container this script runs in. The server joins that
// container's network namespace, so it answers on localhost:$PORT (the SERVER_URL the
// baselines were rendered with) and reaches Postgres by the same hostname this script
// does.
const image = process.env.E2E_IMAGE
const APP_CONTAINER = "pragmatic-papers-e2e-app"
// E2E_BASE_IMAGE starts a second image beside the first, on E2E_BASE_PORT (PORT + 1),
// for E2E_COMMAND to compare with: `pnpm lighthouse` in CI audits dev's image there.
// It gets its own copy of the seeded database, so whatever migrations it runs as it
// starts can't change the one the image under test reads. If it won't start, the
// command runs without it, and BASE_SERVER_URL stays unset.
const baseImage = process.env.E2E_BASE_IMAGE
const BASE_CONTAINER = "pragmatic-papers-e2e-base"
const basePort = Number(process.env.E2E_BASE_PORT) || Number(process.env.PORT) + 1
// What the server reads at runtime, passed through from this environment. DATABASE_URI,
// PORT and SERVER_URL are set per server, below.
const APP_ENV = ["PAYLOAD_SECRET", "USE_LOCAL_STORAGE", "MERCH_SITE_URL"]
// Where the seed wrote uploads, which the server has to serve from its own filesystem.
const UPLOAD_DIRS = ["public/media", "public/map-assets"]

const docker = (...args) => execFileSync("docker", args, { stdio: "inherit" })

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`the server didn't answer ${url} within ${timeoutMs / 1000}s`)
}

// Starts an image's server on the seeded database, then has it throw away what its build
// prerendered from an empty one — what dockerfiles/scripts/start.sh does in a preview,
// without the preview's database copy. `listenPort` and `url` default to this script's PORT
// and SERVER_URL; logs follow this script's output unless `quiet`.
async function startImageServer({
  name = APP_CONTAINER,
  from = image,
  databaseUri: uri = database.uri,
  listenPort = process.env.PORT,
  url = process.env.SERVER_URL,
  quiet = false,
} = {}) {
  if (!process.env.E2E_NETWORK_CONTAINER) {
    throw new Error("E2E_IMAGE needs E2E_NETWORK_CONTAINER, the container to share a network with")
  }
  // The database host as an address: a container sharing another's network namespace
  // may not share its resolver, which is what knows the job's service names.
  const databaseUri = new URL(uri)
  databaseUri.hostname = (await lookup(databaseUri.hostname, { family: 4 })).address

  execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" })
  docker(
    "create",
    "--name",
    name,
    "--network",
    `container:${process.env.E2E_NETWORK_CONTAINER}`,
    ...APP_ENV.flatMap((variable) => ["-e", variable]),
    "-e",
    `PORT=${listenPort}`,
    "-e",
    `SERVER_URL=${url}`,
    "-e",
    `DATABASE_URI=${databaseUri}`,
    // Rendered as a local build, as E2E always has been, not as a preview.
    "-e",
    "BUILD_ENV=",
    from,
    "node",
    "server.js",
  )
  for (const dir of UPLOAD_DIRS) {
    if (existsSync(dir)) docker("cp", `${dir}/.`, `${name}:/app/${dir}`)
  }
  docker("start", name)
  const server = quiet ? null : spawn("docker", ["logs", "--follow", name], { stdio: "inherit" })

  await waitForServer(`${url}/api/users/me`, 180_000)
  const refresh = await fetch(`${url}/next/revalidate-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYLOAD_SECRET}` },
  })
  if (!refresh.ok) throw new Error(`revalidate-all answered ${refresh.status}`)
  console.warn(`${green("✔")} Prerendered routes refreshed from the seeded database.`)
  return server
}

// A copy of the seeded database, made while nothing is connected to it (Postgres won't
// copy a database in use).
async function copyDatabase(uri, copyName) {
  const source = new URL(uri)
  const admin = new URL(uri)
  admin.pathname = "/postgres"
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    const sourceName = decodeURIComponent(source.pathname.slice(1))
    await client.query(`DROP DATABASE IF EXISTS "${copyName}"`)
    await client.query(`CREATE DATABASE "${copyName}" TEMPLATE "${sourceName}"`)
  } finally {
    await client.end()
  }
  const copy = new URL(uri)
  copy.pathname = `/${copyName}`
  return copy.toString()
}

async function dropDatabase(uri) {
  const admin = new URL(uri)
  const name = decodeURIComponent(admin.pathname.slice(1))
  admin.pathname = "/postgres"
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}"`)
  } finally {
    await client.end()
  }
}

let server = null
let baseDatabaseUri = null
try {
  // .next/cache/fetch-cache persists across runs (it's on the bind-mounted
  // repo, not inside the ephemeral test DB or container). unstable_cache
  // entries from an unrelated earlier build — e.g. a local `pnpm dev` session
  // seeded with a different merch catalogue — outlive that DB and get served
  // against this run's freshly-seeded data, since Next's incremental build
  // doesn't know the database underneath it changed. Wipe it so every E2E
  // build is hermetic.
  if (!image) {
    console.warn(`${blue("●")} Clearing .next build cache...`)
    rmSync(".next", { recursive: true, force: true })
  }

  console.warn(`${blue("●")} Seeding E2E test data...`)
  execSync("pnpm exec tsx scripts/seed-e2e.ts", {
    env: process.env,
    stdio: "inherit",
  })

  // CI restores .next/cache from a prior run to speed up `next build`'s
  // compilation — but that directory also holds Next.js's unstable_cache
  // Data Cache (e.g. getCachedGlobal's `global_header`/`global_footer`
  // entries), which persists independent of build freshness. A stale entry
  // cached before this run's seed data existed would otherwise survive the
  // rebuild and serve outdated content. Clear just the data cache, not the
  // whole directory, to keep the compilation-cache speedup while
  // guaranteeing fresh reads of what was just seeded.
  rmSync(".next/cache/fetch-cache", { recursive: true, force: true })

  if (image && baseImage) {
    baseDatabaseUri = await copyDatabase(database.uri, "pragmatic_papers_e2e_base")
  }

  if (image) {
    console.warn(`${blue("●")} Starting ${image}...`)
    server = await startImageServer()
    if (baseImage) {
      const url = `http://localhost:${basePort}`
      console.warn(`${blue("●")} Starting ${baseImage} on ${url} to compare with...`)
      try {
        await startImageServer({
          name: BASE_CONTAINER,
          from: baseImage,
          databaseUri: baseDatabaseUri,
          listenPort: String(basePort),
          url,
          quiet: true,
        })
        process.env.BASE_SERVER_URL = url
      } catch (error) {
        console.warn(`${red("✖")} ${baseImage} didn't start (${error.message}); its last logs:`)
        spawnSync("docker", ["logs", "--tail", "50", BASE_CONTAINER], { stdio: "inherit" })
      }
    }
  } else if (useProdServer) {
    console.warn(`${blue("●")} Building Next.js production bundle...`)
    execSync("./node_modules/.bin/next build", {
      env: { ...process.env, NODE_OPTIONS: "--no-deprecation" },
      stdio: "inherit",
    })
    console.warn(`${blue("●")} Starting Next.js production server...`)
    server = spawn("./node_modules/.bin/next", ["start", "-p", String(process.env.PORT)], {
      env: { ...process.env, NODE_OPTIONS: "--no-deprecation" },
      stdio: "inherit",
    })
  } else {
    console.warn(`${blue("●")} Starting Next.js dev server...`)
    server = spawn(
      "./node_modules/.bin/next",
      ["dev", "-p", String(process.env.PORT), "--turbopack"],
      { env: { ...process.env, NODE_OPTIONS: "--no-deprecation" }, stdio: "inherit" },
    )
  }

  // E2E_COMMAND runs something else against the seeded server in place of the
  // suite: `pnpm lighthouse` audits it with scripts/lighthouse.ts.
  const command = process.env.E2E_COMMAND
  const baselinesBefore = screenshotFingerprint()
  let child
  if (command) {
    console.warn(`${blue("●")} Running ${command}...`)
    child = spawn(command, { env: process.env, stdio: "inherit", shell: true })
  } else {
    console.warn(`${blue("●")} Starting Playwright tests...`)
    child = spawn(
      "./node_modules/.bin/playwright",
      ["test", "--config=playwright.config.ts", ...process.argv.slice(2).filter((a) => a !== "--")],
      { env: process.env, stdio: "inherit" },
    )
  }

  const exitCode = await new Promise((resolve) => child.on("exit", resolve))
  let finalExit = exitCode ?? 0

  // Flaky-baseline gate. When the run above wrote or changed a screenshot
  // baseline, re-render just the @visual tests two more times against the same
  // already-seeded, already-built server (no re-seed, no rebuild) and fail if a
  // baseline only matches its own first render. Opt in with E2E_VERIFY_VISUAL;
  // it skips itself when no baseline changed, so PRs that touch no screenshots
  // pay nothing — the same scope as gating on "a baseline was committed".
  if (process.env.E2E_VERIFY_VISUAL && !command) {
    if (screenshotFingerprint() !== baselinesBefore) {
      console.warn(`${blue("●")} Verifying screenshot determinism (@visual ×2)...`)
      const verify = spawn(
        "./node_modules/.bin/playwright",
        [
          "test",
          "--config=playwright.config.ts",
          "--grep",
          "@visual",
          "--repeat-each=2",
          "--retries=0",
          "--project=chromium",
        ],
        { env: process.env, stdio: "inherit" },
      )
      const verifyExit = await new Promise((resolve) => verify.on("exit", resolve))
      if (verifyExit) {
        console.error(
          `${red("✖")} Screenshot determinism check failed — a baseline only matches its own ` +
            `first render. Make the capture deterministic (see tests/e2e/README.md), don't widen ` +
            `the tolerance.`,
        )
        finalExit = verifyExit
        // Signal a determinism-gate failure distinctly from the benign
        // "wrote a missing baseline" failure. CI keys off this so it refuses
        // to commit and greenlight a flaky baseline (see playwright.yml).
        if (process.env.GITHUB_OUTPUT) {
          appendFileSync(process.env.GITHUB_OUTPUT, "determinism_failed=true\n")
        }
      }
    } else {
      console.warn(`${green("✔")} No baseline changes — skipping screenshot determinism check.`)
    }
  }

  process.exitCode = finalExit
} catch (error) {
  console.error(`${red("✖")} Error during E2E test setup: ${error.message}`)
  process.exitCode = 1
} finally {
  // A server that already exited (a crashed container ends `docker logs`) has no exit
  // event left to wait for.
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM")
    await new Promise((resolve) => server.once("exit", resolve))
  }
  if (image) {
    for (const name of [APP_CONTAINER, BASE_CONTAINER]) {
      // Fails, harmlessly, for a container that was never started.
      spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" })
    }
  }
  if (baseDatabaseUri) {
    await dropDatabase(baseDatabaseUri).catch((error) => {
      console.warn(`Couldn't drop the base image's database copy: ${error.message}`)
    })
  }
  console.warn(`${blue("●")} Stopping the test database...`)
  database.stop()
}
