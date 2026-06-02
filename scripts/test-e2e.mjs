import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync, spawn } from "node:child_process"
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

console.warn(`${blue("●")} Starting Postgres container...`)
const container = await new PostgreSqlContainer("postgres:15-alpine")
  .withDatabase("pragmatic-papers-test")
  .start()

const uri = container.getConnectionUri()
process.env.DATABASE_URI = uri
process.env.PAYLOAD_SECRET ??= "test-secret-for-e2e-tests"
process.env.USE_LOCAL_STORAGE ??= "true"
process.env.PORT ??= "8000"
process.env.NEXT_PUBLIC_SERVER_URL ??= `http://localhost:${process.env.PORT}`
process.env.PAYLOAD_CONFIG_PATH ??= "src/payload.config.ts"
process.env.E2E_MANAGED_SERVER = "true"

console.warn(`${green("✔")} Test database started at ${uri}`)

const port = Number(process.env.PORT)
if (await isPortInUse(port)) {
  console.error(
    `${red("✖")} Port ${port} is already in use. ` +
      `Stop the process bound to it (e.g. \`lsof -ti:${port} | xargs kill\`) before running E2E tests.`,
  )
  await container.stop()
  process.exit(1)
}

let server = null
try {
  console.warn(`${blue("●")} Starting Next.js dev server...`)
  server = spawn("pnpm", ["dev:next"], { env: process.env, stdio: "inherit" })

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

  console.warn(`${blue("●")} Starting Playwright tests...`)
  const child = spawn(
    "./node_modules/.bin/playwright",
    ["test", "--config=playwright.config.ts", ...process.argv.slice(2).filter((a) => a !== "--")],
    { env: process.env, stdio: "inherit" },
  )

  const exitCode = await new Promise((resolve) => child.on("exit", resolve))
  process.exitCode = exitCode ?? 0
} catch (error) {
  console.error(`${red("✖")} Error during E2E test setup: ${error.message}`)
  process.exitCode = 1
} finally {
  server?.kill()
  console.warn(`${blue("●")} Stopping Postgres container...`)
  await container.stop()
}
