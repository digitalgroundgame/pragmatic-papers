import { execSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { Client } from "pg"
import { startTestDatabase } from "../../scripts/test-db.mjs"

/** Drops the per-file databases this run created. Every worker has exited by now. */
async function dropRunDatabases(prefix: string): Promise<void> {
  const client = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: "postgres",
  })
  await client.connect()
  try {
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE starts_with(datname, $1)",
      [prefix],
    )
    for (const { datname } of rows) {
      await client.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`)
    }
  } finally {
    await client.end()
  }
}

export async function setup(): Promise<() => Promise<void>> {
  process.env.PAYLOAD_SECRET ||= "test-secret-for-integration-tests"
  process.env.USE_LOCAL_STORAGE ||= "true"
  process.env.SERVER_URL ||= "http://localhost:8000"

  // The migrated database every test file copies (integration-db-setup.ts). A snapshot
  // image skips `payload migrate` on the next run (scripts/test-db.mjs).
  const database = await startTestDatabase({
    snapshot: true,
    migrate: (uri) => {
      console.warn("Running database migrations on template database...")
      execSync("pnpm payload migrate", {
        env: { ...process.env, DATABASE_URI: uri },
        stdio: "inherit",
      })
    },
  })

  const parsed = new URL(database.uri)
  process.env.PG_HOST = parsed.hostname
  process.env.PG_PORT = parsed.port || "5432"
  process.env.PG_USER = decodeURIComponent(parsed.username)
  process.env.PG_PASSWORD = decodeURIComponent(parsed.password)
  process.env.PG_TEMPLATE_DB = decodeURIComponent(parsed.pathname.slice(1))
  // Every per-file database this run creates starts with it, so teardown can find them.
  const prefix = `test_${randomUUID().slice(0, 8)}_`
  process.env.PG_DB_PREFIX = prefix

  return async (): Promise<void> => {
    // A container takes its databases with it; a TEST_DATABASE_URI server keeps them.
    if (process.env.TEST_DATABASE_URI) await dropRunDatabases(prefix)
    database.stop()
  }
}
