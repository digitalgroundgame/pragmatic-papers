import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { spawn, execSync } from "node:child_process"

console.warn("Starting Postgres container...")
const container = await new PostgreSqlContainer("postgres:15-alpine")
  .withDatabase("pragmatic-papers-test")
  .start()

const uri = container.getConnectionUri()
process.env.DATABASE_URI = uri
process.env.PAYLOAD_SECRET ??= "test-secret-for-e2e-tests"
process.env.USE_LOCAL_STORAGE ??= "true"
process.env.PORT ??= "8001"
process.env.NEXT_PUBLIC_SERVER_URL ??= `http://localhost:${process.env.PORT}`

console.warn(`Test database started at ${uri}`)

try {
  console.warn("Running database migrations...")
  execSync("pnpm payload migrate", {
    env: process.env,
    stdio: "inherit",
  })

  console.warn("Starting Playwright tests...")
  const child = spawn(
    "pnpm",
    ["exec", "playwright", "test", "--config=playwright.config.ts", ...process.argv.slice(2)],
    { env: process.env, stdio: "inherit" },
  )

  const exitCode = await new Promise((resolve) => child.on("exit", resolve))
  process.exitCode = exitCode ?? 0
} catch (error) {
  console.error("Error during E2E test setup:", error)
  process.exitCode = 1
} finally {
  console.warn("Stopping Postgres container...")
  await container.stop()
}
