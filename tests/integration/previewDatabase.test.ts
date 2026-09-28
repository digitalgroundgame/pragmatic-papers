import { randomUUID } from "node:crypto"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { pgServer } from "../../dockerfiles/scripts/preview-database"

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
  for (const db of [source, target, `${target}_incoming`]) {
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
