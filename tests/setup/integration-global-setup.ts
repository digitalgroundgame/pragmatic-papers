import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync } from "node:child_process"

const TEMPLATE_DB = "pp_template"

export async function setup(): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase(TEMPLATE_DB)
    .start()

  const uri = container.getConnectionUri()
  process.env.DATABASE_URI = uri
  process.env.PAYLOAD_SECRET ??= "test-secret-for-integration-tests"
  process.env.USE_LOCAL_STORAGE ??= "true"
  process.env.NEXT_PUBLIC_SERVER_URL ??= "http://localhost:8000"

  console.warn(`Integration test database started at ${uri}`)

  try {
    console.warn("Running database migrations on template database...")
    execSync("pnpm payload migrate", {
      env: process.env,
      stdio: "inherit",
    })
  } catch (error) {
    console.error("Error during integration test migration:", error)
    await container.stop()
    throw error
  }

  delete (process.env as { DATABASE_URI?: string }).DATABASE_URI

  const parsed = new URL(uri)
  process.env.PG_HOST = parsed.hostname
  process.env.PG_PORT = parsed.port
  process.env.PG_USER = parsed.username
  process.env.PG_PASSWORD = parsed.password
  process.env.PG_TEMPLATE_DB = TEMPLATE_DB

  return async (): Promise<void> => {
    await container.stop()
  }
}
