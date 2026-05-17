import { PostgreSqlContainer } from "@testcontainers/postgresql"

export async function setup(): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("pragmatic-papers-test")
    .start()

  process.env.DATABASE_URI = container.getConnectionUri()
  process.env.PAYLOAD_SECRET ??= "test-secret-for-integration-tests"
  process.env.USE_LOCAL_STORAGE ??= "true"

  return async (): Promise<void> => {
    await container.stop()
  }
}
