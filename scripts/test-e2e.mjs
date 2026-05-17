import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { spawn } from "node:child_process"

const container = await new PostgreSqlContainer("postgres:15-alpine")
  .withDatabase("pragmatic-papers-test")
  .start()

process.env.DATABASE_URI = container.getConnectionUri()
process.env.PAYLOAD_SECRET ??= "test-secret-for-e2e-tests"
process.env.USE_LOCAL_STORAGE ??= "true"

const child = spawn(
  "pnpm",
  ["exec", "playwright", "test", "--config=playwright.config.ts"],
  { env: process.env, stdio: "inherit" },
)

const exitCode = await new Promise((resolve) => child.on("exit", resolve))
await container.stop()
process.exit(exitCode ?? 0)
