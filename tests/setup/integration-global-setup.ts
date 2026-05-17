import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync } from "node:child_process"

export async function setup(): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("pragmatic-papers-test")
    .start()

  const uri = container.getConnectionUri()
  process.env.DATABASE_URI = uri
  process.env.PAYLOAD_SECRET ??= "test-secret-for-integration-tests"
  process.env.USE_LOCAL_STORAGE ??= "true"
  process.env.NEXT_PUBLIC_SERVER_URL ??= "http://localhost:8000"

  console.warn(`Integration test database started at ${uri}`)

  try {
    console.warn("Running database migrations for integration tests...")
    execSync("pnpm payload migrate", {
      env: process.env,
      stdio: "inherit",
    })
  } catch (error) {
    console.error("Error during integration test migration:", error)
    await container.stop()
    throw error
  }

  return async (): Promise<void> => {
    await container.stop()
  }
}
