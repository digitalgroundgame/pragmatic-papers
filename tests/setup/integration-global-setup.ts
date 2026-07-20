import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync } from "node:child_process"

const TEMPLATE_DB = "pp_template"

export async function setup(): Promise<() => Promise<void>> {
  process.env.PAYLOAD_SECRET ??= "test-secret-for-integration-tests"
  process.env.USE_LOCAL_STORAGE ??= "true"
  process.env.NEXT_PUBLIC_SERVER_URL ??= "http://localhost:8000"

  let container = null
  let uri: string

  if (process.env.DATABASE_URI) {
    uri = process.env.DATABASE_URI
    console.warn(`Using existing DATABASE_URI — skipping container startup.`)
  } else {
    container = await new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase(TEMPLATE_DB)
      .start()
    uri = container.getConnectionUri()
    process.env.DATABASE_URI = uri
    console.warn(`Integration test database started at ${uri}`)
  }

  try {
    console.warn("Running database migrations on template database...")
    execSync("pnpm payload migrate", {
      env: process.env,
      stdio: "inherit",
    })
  } catch (error) {
    console.error("Error during integration test migration:", error)
    if (container) await container.stop()
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
    if (container) await container.stop()
  }
}
