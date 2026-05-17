import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { spawn, execSync } from "node:child_process"
import { blue, green, red } from "./ansi.mjs"

console.warn(`${blue("●")} Starting Postgres container...`)
const container = await new PostgreSqlContainer("postgres:15-alpine")
  .withDatabase("pragmatic-papers-test")
  .start()

const uri = container.getConnectionUri()
process.env.DATABASE_URI = uri
process.env.PAYLOAD_SECRET ??= "test-secret-for-e2e-tests"
process.env.USE_LOCAL_STORAGE ??= "true"
process.env.PORT ??= "8001"
process.env.NEXT_PUBLIC_SERVER_URL ??= `http://localhost:${process.env.PORT}`

console.warn(`${green("✔")} Test database started at ${uri}`)

try {
  console.warn(`${blue("●")} Running database migrations...`)
  execSync("pnpm payload migrate", {
    env: process.env,
    stdio: "inherit",
  })

  console.warn(`${blue("●")} Starting Playwright tests...`)
  const child = spawn(
    "pnpm",
    ["exec", "playwright", "test", "--config=playwright.config.ts", ...process.argv.slice(2)],
    { env: process.env, stdio: "inherit" },
  )

  const exitCode = await new Promise((resolve) => child.on("exit", resolve))
  process.exitCode = exitCode ?? 0
} catch (error) {
  console.error(`${red("✖")} Error during E2E test setup: ${error.message}`)
  process.exitCode = 1
} finally {
  console.warn(`${blue("●")} Stopping Postgres container...`)
  await container.stop()
}
