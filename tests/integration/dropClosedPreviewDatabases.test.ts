import { randomUUID } from "node:crypto"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { main } from "../../dockerfiles/scripts/drop-closed-preview-databases"

// The cleanup's real SQL on the integration Postgres: which names it matches, the LIKE
// escaping, and dropping a database something is still connected to. GitHub is faked.
const { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD } = process.env

const serverUri = (db: string) => {
  const url = new URL("postgres://")
  url.hostname = PG_HOST!
  url.port = PG_PORT!
  url.username = PG_USER!
  url.password = PG_PASSWORD!
  url.pathname = `/${db}`
  return url.toString()
}

// A random source name, so the test only ever sees and drops its own databases.
const source = `cleanup_${randomUUID().slice(0, 8)}`
const databases = {
  closed: `${source}_pr_3`,
  closedIncoming: `${source}_pr_3_incoming`,
  open: `${source}_pr_12`,
  current: `${source}_pr_40`,
  // Not previews of `source`, though a careless LIKE or regex would match them.
  lookalike: `${source}x_pr_3`,
  // `_` is a LIKE wildcard, so an unescaped source name would match this one too.
  underscoreWildcard: `${source.replace("_", "X")}_pr_3`,
  suffixed: `${source}_pr_3_old`,
}
let admin: pg.Client

const exists = async (db: string) =>
  (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [db])).rowCount === 1

beforeAll(async () => {
  admin = new pg.Client({ connectionString: serverUri("postgres") })
  await admin.connect()
  for (const db of Object.values(databases)) await admin.query(`CREATE DATABASE "${db}"`)
})

afterAll(async () => {
  for (const db of Object.values(databases)) {
    await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`)
  }
  await admin.end()
})

describe("drop-closed-preview-databases", () => {
  it("drops closed PRs' preview databases, even with a client connected, and nothing else", async () => {
    const straggler = new pg.Client({ connectionString: serverUri(databases.closed) })
    straggler.on("error", () => undefined)
    await straggler.connect()

    const logs: string[] = []
    const status = await main(
      {
        COPY_SOURCE_DATABASE: "true",
        SOURCE_DATABASE_NAME: source,
        DATABASE_URI: serverUri(databases.current),
      },
      {
        fetch: async () => new Response(JSON.stringify([{ number: 12 }, { number: 40 }])),
        log: (message) => logs.push(message),
      },
    )
    await straggler.end().catch(() => undefined)

    expect(status).toBe(0)
    expect(logs).toContain(`Dropped ${databases.closed}`)
    expect(await exists(databases.closed)).toBe(false)
    expect(await exists(databases.closedIncoming)).toBe(false)
    for (const kept of [
      "open",
      "current",
      "lookalike",
      "underscoreWildcard",
      "suffixed",
    ] as const) {
      expect(await exists(databases[kept]), kept).toBe(true)
    }
  })
})
