import { randomUUID } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { main, pgServer } from "../../dockerfiles/scripts/preview-database"

// The real SQL behind copyDatabase's Server, on the integration Postgres. The copy's
// ordering is unit-tested in tests/scripts/preview-database.test.ts.
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

const prefix = `preview_${randomUUID().slice(0, 8)}`
const source = `${prefix}_staging`
const target = `${prefix}_pr_1`
let admin: pg.Client

/** Opens a connection to `db` that stays idle, like a running app's pool. */
async function connectTo(db: string): Promise<{ client: pg.Client; lost: Promise<boolean> }> {
  const client = new pg.Client({ connectionString: serverUri(db) })
  const lost = new Promise<boolean>((resolve) => client.on("error", () => resolve(true)))
  await client.connect()
  return { client, lost }
}

beforeAll(async () => {
  admin = new pg.Client({ connectionString: serverUri("postgres") })
  await admin.connect()
  await admin.query(`CREATE DATABASE "${source}"`)
  const seed = new pg.Client({ connectionString: serverUri(source) })
  await seed.connect()
  await seed.query("CREATE TABLE articles (id int)")
  await seed.end()
})

afterAll(async () => {
  for (const db of [
    source,
    target,
    `${target}_incoming`,
    `${prefix}_pr_2`,
    `${prefix}_pr_2_incoming`,
  ]) {
    await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`)
  }
  await admin.end()
})

describe("pgServer", () => {
  it("reports a template in use as busy, leaving its clients connected (#1057)", async () => {
    const server = await pgServer(serverUri(target))
    const staging = await connectTo(source)
    try {
      expect(await server.createFromTemplate(target, source)).toBe("busy")
      expect(await server.exists(target)).toBe(false)
      await expect(staging.client.query("SELECT 1")).resolves.toBeTruthy()
    } finally {
      await staging.client.end()
      await server.close()
    }
  })

  it("copies an idle template", async () => {
    const server = await pgServer(serverUri(target))
    try {
      expect(await server.createFromTemplate(target, source)).toBe("copied")
      expect(await server.exists(target)).toBe(true)
    } finally {
      await server.close()
    }
  })

  it("drops a database its app is still connected to, then renames another into place", async () => {
    const server = await pgServer(serverUri(target))
    const preview = await connectTo(target)
    try {
      await server.create(`${target}_incoming`)
      await server.drop(target)
      expect(await preview.lost).toBe(true)
      await server.rename(`${target}_incoming`, target)
      expect(await server.exists(target)).toBe(true)
      expect(await server.exists(`${target}_incoming`)).toBe(false)
    } finally {
      await preview.client.end().catch(() => undefined)
      await server.close()
    }
  })
})

describe("main", () => {
  // A preview build end to end on a real server: main resolves the preview's database from
  // COOLIFY_FQDN, connects with the real pgServer and copies. The source is idle here, so the
  // copy takes the template path and pg_dump isn't needed; migrations are a stand-in that
  // adds a column, the way a branch's migration would.
  const preview = `${prefix}_pr_2`
  const env = {
    BUILD_ENV: "preview",
    COOLIFY_FQDN: "pr-2.example.com",
    DATABASE_URI: serverUri(prefix),
    COPY_SOURCE_DATABASE: "true",
    SOURCE_DATABASE_URI: serverUri(source),
  }
  const noDump = () => Promise.reject(new Error("the template path shouldn't need pg_dump"))
  const addColumn = async (uri: string) => {
    const client = new pg.Client({ connectionString: uri })
    await client.connect()
    await client.query("ALTER TABLE articles ADD COLUMN show_table_of_contents boolean")
    await client.end()
  }
  const columns = async (db: string) => {
    const client = new pg.Client({ connectionString: serverUri(db) })
    await client.connect()
    const { rows } = await client.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'articles' ORDER BY 1",
    )
    await client.end()
    return rows.map((row) => row.column_name)
  }
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "preview-database-"))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("creates the preview's own database as a copy of the source", async () => {
    const envFile = join(dir, "database_uri.env")
    expect(await main(env, envFile, { dumpRestore: noDump })).toBe(0)
    expect(readFileSync(envFile, "utf-8")).toContain(`/${preview}'`)
    expect(await columns(preview)).toEqual(["id"])
  })

  it("swaps in a migrated recopy, disconnecting the old container only then (#1058)", async () => {
    const old = await connectTo(preview)
    const status = await main(
      { ...env, FORCE_DATABASE_COPY: "true" },
      join(dir, "database_uri.env"),
      { dumpRestore: noDump, migrate: addColumn },
    )
    expect(status).toBe(0)
    expect(await old.lost).toBe(true)
    await old.client.end().catch(() => undefined)
    expect(await columns(preview)).toEqual(["id", "show_table_of_contents"])
    const server = await pgServer(serverUri(preview))
    expect(await server.exists(`${preview}_incoming`)).toBe(false)
    await server.close()
  })
})
