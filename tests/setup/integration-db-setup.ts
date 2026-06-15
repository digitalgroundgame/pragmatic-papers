import { Client } from "pg"
import { randomUUID } from "node:crypto"

const { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_TEMPLATE_DB } = process.env

if (!PG_HOST || !PG_PORT || !PG_USER || PG_PASSWORD === undefined || !PG_TEMPLATE_DB) {
  throw new Error(
    "Missing PG_* env vars — integration-global-setup may not have run. " +
      "Ensure integration tests are run via the vitest integration project config.",
  )
}

const dbName = `test_${randomUUID().replace(/-/g, "_")}`

const client = new Client({
  host: PG_HOST,
  port: Number(PG_PORT),
  user: PG_USER,
  password: PG_PASSWORD,
  database: "postgres",
})

await client.connect()
await client.query(`CREATE DATABASE "${dbName}" TEMPLATE "${PG_TEMPLATE_DB}"`)
await client.end()

const url = new URL("postgres://")
url.hostname = PG_HOST
url.port = PG_PORT
url.username = PG_USER
url.password = PG_PASSWORD
url.pathname = `/${dbName}`

process.env.DATABASE_URI = url.toString()

// Databases are intentionally not dropped here — the container is ephemeral
// and destroyed by integration-global-setup's teardown. Dropping per-file
// databases with FORCE terminates Payload's pool connections and causes
// unhandled "terminating connection" errors. Container cleanup is sufficient.
