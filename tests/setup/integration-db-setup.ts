import { Client } from "pg"
import { randomUUID } from "node:crypto"

const { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_TEMPLATE_DB, PG_DB_PREFIX } = process.env

if (
  !PG_HOST ||
  !PG_PORT ||
  !PG_USER ||
  PG_PASSWORD === undefined ||
  !PG_TEMPLATE_DB ||
  !PG_DB_PREFIX
) {
  throw new Error(
    "Missing PG_* env vars — integration-global-setup may not have run. " +
      "Ensure integration tests are run via the vitest integration project config.",
  )
}

const dbName = `${PG_DB_PREFIX}${randomUUID().replace(/-/g, "_")}`

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
url.username = encodeURIComponent(PG_USER)
url.password = encodeURIComponent(PG_PASSWORD)
url.pathname = `/${dbName}`

// Set, never read: whatever DATABASE_URI the shell or `.env` holds names the dev
// database, and Payload (src/payload.config.ts) connects to this one instead.
process.env.DATABASE_URI = url.toString()

// Databases are intentionally not dropped here — dropping per-file databases with
// FORCE terminates Payload's pool connections and causes unhandled "terminating
// connection" errors. integration-global-setup's teardown removes them once every
// worker has exited: with the container, or by PG_DB_PREFIX on a TEST_DATABASE_URI server.
