import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync, spawn } from "node:child_process"
import { appendFileSync } from "node:fs"
import net from "node:net"
import { blue, green, red } from "./ansi.mjs"

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

process.env.PAYLOAD_SECRET ||= "test-secret-for-e2e-tests"

let container = null

if (process.env.DATABASE_URI) {
  console.warn(`${green("✔")} Using existing DATABASE_URI — skipping container startup.`)
} else {
  console.warn(`${blue("●")} Starting Postgres container...`)
  container = await new PostgreSqlContainer("postgres:17-alpine")
    .withDatabase("pragmatic-papers-test")
    .start()
  process.env.DATABASE_URI = container.getConnectionUri()
  console.warn(`${green("✔")} Test database started at ${process.env.DATABASE_URI}`)
}
process.env.USE_LOCAL_STORAGE ||= "true"
process.env.PORT ||= "8000"
process.env.NEXT_PUBLIC_SERVER_URL ||= `http://localhost:${process.env.PORT}`
process.env.PAYLOAD_CONFIG_PATH ||= "src/payload.config.ts"
process.env.E2E_MANAGED_SERVER = "true"

const port = Number(process.env.PORT)
if (await isPortInUse(port)) {
  console.error(
    `${red("✖")} Port ${port} is already in use. ` +
      `Stop the process bound to it (e.g. \`lsof -ti:${port} | xargs kill\`) before running E2E tests.`,
  )
  await container.stop()
  process.exit(1)
}

// A production server (`next build` + `next start`) renders deterministically —
// no dev overlay, no on-demand compilation, no hot-reload artifacts — so CI
// uses it for stable screenshots. Local runs default to the faster dev server.
const useProdServer = !!process.env.E2E_PROD_SERVER

let server = null
try {
  console.warn(`${blue("●")} Running database migrations...`)
  execSync("pnpm payload migrate", {
    env: process.env,
    stdio: "inherit",
  })

  console.warn(`${blue("●")} Seeding E2E test data...`)
  execSync("pnpm exec tsx scripts/seed-e2e.ts", {
    env: process.env,
    stdio: "inherit",
  })

  if (useProdServer) {
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

  console.warn(`${blue("●")} Starting Playwright tests...`)
  const child = spawn(
    "./node_modules/.bin/playwright",
    ["test", "--config=playwright.config.ts", ...process.argv.slice(2).filter((a) => a !== "--")],
    { env: process.env, stdio: "inherit" },
  )

  const exitCode = await new Promise((resolve) => child.on("exit", resolve))
  let finalExit = exitCode ?? 0

  // Flaky-baseline gate. When the run above wrote or changed a screenshot
  // baseline, re-render just the @visual tests two more times against the same
  // already-seeded, already-built server (no re-seed, no rebuild) and fail if a
  // baseline only matches its own first render. Opt in with E2E_VERIFY_VISUAL;
  // it skips itself when no baseline changed, so PRs that touch no screenshots
  // pay nothing — the same scope as gating on "a baseline was committed".
  if (process.env.E2E_VERIFY_VISUAL) {
    const changedBaselines = execSync("git status --porcelain -- tests/e2e/__screenshots__", {
      env: process.env,
    })
      .toString()
      .trim()
    if (changedBaselines) {
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
  if (server) {
    server.kill("SIGTERM")
    await new Promise((resolve) => server.once("exit", resolve))
  }
  if (container) {
    console.warn(`${blue("●")} Stopping Postgres container...`)
    await container.stop()
  }
}
