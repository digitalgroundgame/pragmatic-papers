import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  copyDatabase,
  databaseName,
  dumpRestore,
  envFileLine,
  main,
  type MainDeps,
  maskUri,
  migrate,
  type PgClient,
  pgServer,
  resolveDatabaseUri,
  sameServer,
  type Server,
  withDatabase,
} from "../../dockerfiles/scripts/preview-database"

const SCRIPT = resolve(__dirname, "../../dockerfiles/scripts/preview-database.ts")

// The password holds an escaped @, which the shell scripts' sed parsing got wrong.
const STAGING = "postgresql://pp:s3cr%40t@db:5432/staging"
const BASE = "postgresql://pp:pw@db:5432/pragmatic_papers?sslmode=require"

describe("URIs", () => {
  it("masks the password", () => {
    expect(maskUri("postgresql://pp:hunter2@db:5432/x")).toBe("postgresql://pp:****@db:5432/x")
    expect(maskUri("not a uri")).not.toContain("not a uri")
  })

  it("switches database but keeps credentials and parameters", () => {
    expect(withDatabase(BASE, "other")).toBe("postgresql://pp:pw@db:5432/other?sslmode=require")
    expect(databaseName(BASE)).toBe("pragmatic_papers")
  })

  it("reads a password containing @ and /", () => {
    const uri = "postgresql://pp:a%40b%2Fc@db:5432/staging"
    expect(databaseName(uri)).toBe("staging")
    expect(maskUri(uri)).toBe("postgresql://pp:****@db:5432/staging")
  })

  it("rejects anything that isn't a postgres URI", () => {
    expect(() => databaseName("mysql://db/x")).toThrow(/Not a PostgreSQL URI/)
  })

  it("rejects an unparseable URI without echoing its password", () => {
    expect(() => databaseName("postgresql://pp:hunter2@[db/x")).toThrow(
      /^Not a valid PostgreSQL URI: <unparseable URI>$/,
    )
  })

  it("rejects a URI without a database, masking its password", () => {
    expect(() => databaseName("postgresql://pp:hunter2@db:5432")).toThrow(
      "No database name in postgresql://pp:****@db:5432",
    )
  })

  it("leaves a URI without a password as it is", () => {
    expect(maskUri("postgresql://pp@db/x")).toBe("postgresql://pp@db/x")
  })

  it("treats a missing port as Postgres's default when comparing servers", () => {
    expect(sameServer("postgresql://a@db/x", "postgresql://b@db:5432/y")).toBe(true)
    expect(sameServer("postgresql://a@db:5432/x", "postgresql://b@db/y")).toBe(true)
    expect(sameServer("postgresql://a@db:5433/x", "postgresql://a@db:5432/x")).toBe(false)
    expect(sameServer("postgresql://a@db/x", "postgresql://a@other/x")).toBe(false)
  })
})

describe("resolveDatabaseUri", () => {
  it("requires DATABASE_URI", () => {
    expect(() => resolveDatabaseUri({ BUILD_ENV: "production" })).toThrow("DATABASE_URI is not set")
  })

  it("keeps DATABASE_URI outside previews", () => {
    expect(resolveDatabaseUri({ BUILD_ENV: "staging", DATABASE_URI: BASE })).toBe(BASE)
  })

  it("gives a preview its own database, named after its host", () => {
    expect(
      resolveDatabaseUri({
        BUILD_ENV: "preview",
        COOLIFY_FQDN: "pr-748.pragmaticpapers.com",
        DATABASE_URI: BASE,
      }),
    ).toBe("postgresql://pp:pw@db:5432/pragmatic_papers_pr_748?sslmode=require")
  })

  it("fails a preview that can't name its database instead of sharing one (#1058)", () => {
    expect(() => resolveDatabaseUri({ BUILD_ENV: "preview", DATABASE_URI: BASE })).toThrow(
      /COOLIFY_FQDN is not set/,
    )
  })

  it("fails on a database name Postgres would truncate", () => {
    expect(() =>
      resolveDatabaseUri({
        BUILD_ENV: "preview",
        COOLIFY_FQDN: `${"x".repeat(60)}.example.com`,
        DATABASE_URI: BASE,
      }),
    ).toThrow(/longer than Postgres allows/)
  })
})

describe("envFileLine", () => {
  it("quotes the URI so the shell reads it back unchanged", () => {
    expect(envFileLine("postgresql://pp:it's@db/x")).toBe(
      "export DATABASE_URI='postgresql://pp:it'\\''s@db/x'\n",
    )
  })
})

/** A fake server that records every call. `busy` databases refuse to be a template. */
function fakeServer({ existing = [] as string[], busy = [] as string[] } = {}) {
  const calls: string[] = []
  const databases = new Set(existing)
  const server: Server = {
    async exists(db) {
      return databases.has(db)
    },
    async createFromTemplate(db, template) {
      calls.push(`template ${template} -> ${db}`)
      if (busy.includes(template)) return "busy"
      databases.add(db)
      return "copied"
    },
    async create(db) {
      calls.push(`create ${db}`)
      databases.add(db)
    },
    async drop(db) {
      calls.push(`drop ${db}`)
      databases.delete(db)
    },
    async rename(from, to) {
      calls.push(`rename ${from} -> ${to}`)
      databases.delete(from)
      databases.add(to)
    },
  }
  return { server, calls, databases }
}

function copy(
  server: Server,
  calls: string[],
  {
    force = false,
    migrateFails = false,
    dumpFails = false,
    targetUri = "postgresql://pp:pw@db:5432/pp_pr_748",
  } = {},
) {
  return copyDatabase(
    {
      server,
      log: () => undefined,
      async dumpRestore(from, to) {
        calls.push(`dump ${databaseName(from)} -> ${databaseName(to)}`)
        if (dumpFails) throw new Error("pg_dump exited with 1")
      },
      async migrate(uri) {
        calls.push(`migrate ${databaseName(uri)}`)
        if (migrateFails) throw new Error("payload migrate exited with 1")
      },
    },
    { sourceUri: STAGING, targetUri, force },
  )
}

describe("copyDatabase", () => {
  it("copies an idle source with a template", async () => {
    const { server, calls } = fakeServer()
    await copy(server, calls)
    expect(calls).toEqual(["template staging -> pp_pr_748"])
  })

  it("falls back to dump/restore rather than disconnecting a busy source (#1057)", async () => {
    const { server, calls } = fakeServer({ busy: ["staging"] })
    await copy(server, calls)
    expect(calls).toEqual([
      "template staging -> pp_pr_748",
      "create pp_pr_748",
      "dump staging -> pp_pr_748",
    ])
    expect(calls).not.toContain("drop staging")
  })

  it("dumps across servers without trying a template", async () => {
    const { server, calls } = fakeServer()
    await copy(server, calls, { targetUri: "postgresql://pp:pw@other:5432/pp_pr_748" })
    expect(calls).toEqual(["create pp_pr_748", "dump staging -> pp_pr_748"])
  })

  it("drops a half-restored copy so the next build copies again", async () => {
    const { server, calls, databases } = fakeServer({ busy: ["staging"] })
    await expect(copy(server, calls, { dumpFails: true })).rejects.toThrow(/pg_dump/)
    expect(calls.at(-1)).toBe("drop pp_pr_748")
    expect(databases.has("pp_pr_748")).toBe(false)
  })

  it("leaves an existing target alone without FORCE_DATABASE_COPY", async () => {
    const { server, calls } = fakeServer({ existing: ["pp_pr_748"] })
    await copy(server, calls)
    expect(calls).toEqual([])
  })

  it("never copies a database onto itself", async () => {
    const { server, calls } = fakeServer({ existing: ["staging"] })
    await copy(server, calls, { force: true, targetUri: "postgresql://pp:pw@db:5432/staging" })
    expect(calls).toEqual([])
  })

  it("migrates a forced copy beside the live target before swapping it in (#1058)", async () => {
    const { server, calls, databases } = fakeServer({ existing: ["pp_pr_748"], busy: ["staging"] })
    await copy(server, calls, { force: true })
    expect(calls).toEqual([
      "drop pp_pr_748_incoming",
      "template staging -> pp_pr_748_incoming",
      "create pp_pr_748_incoming",
      "dump staging -> pp_pr_748_incoming",
      "migrate pp_pr_748_incoming",
      "drop pp_pr_748",
      "rename pp_pr_748_incoming -> pp_pr_748",
    ])
    expect([...databases]).toEqual(["pp_pr_748"])
  })

  it("refuses a staging name Postgres would truncate, before touching anything", async () => {
    const long = "p".repeat(60)
    const { server, calls } = fakeServer({ existing: [long] })
    await expect(
      copy(server, calls, { force: true, targetUri: `postgresql://pp:pw@db:5432/${long}` }),
    ).rejects.toThrow(/longer than Postgres allows/)
    expect(calls).toEqual([])
  })

  it("keeps the live target when the forced copy fails to migrate", async () => {
    const { server, calls } = fakeServer({ existing: ["pp_pr_748"] })
    await expect(copy(server, calls, { force: true, migrateFails: true })).rejects.toThrow(
      /payload migrate/,
    )
    expect(calls).not.toContain("drop pp_pr_748")
  })
})

/** A pg client that records queries, failing the ones matching `fail` with the given errors in turn. */
function fakeClient(fail: { match: RegExp; errors: { code?: string; message: string }[] }[] = []) {
  const queries: { text: string; values?: unknown[] }[] = []
  const events: string[] = []
  const client = {
    async connect() {
      events.push("connect")
    },
    async end() {
      events.push("end")
    },
    escapeIdentifier: (name: string) => `"${name.replaceAll('"', '""')}"`,
    async query(text: string, values?: unknown[]) {
      events.push("query")
      queries.push({ text, values })
      for (const rule of fail) {
        if (rule.match.test(text) && rule.errors.length) {
          throw Object.assign(new Error(rule.errors[0]!.message), rule.errors.shift())
        }
      }
      return { rowCount: text.startsWith("SELECT 1") && values?.[0] === "there" ? 1 : 0 }
    },
  }
  return { client: client as unknown as PgClient, queries, events }
}

const IN_USE = { code: "55006", message: "database is being accessed by other users" }

describe("pgServer", () => {
  const connect = (client: PgClient) =>
    pgServer("postgresql://pp:pw@db:5432/pp_pr_748", { client, retryDelayMs: 0 })

  it("connects before its first query and disconnects on close", async () => {
    const { client, events } = fakeClient()
    const server = await connect(client)
    await server.exists("x")
    await server.close()
    expect(events).toEqual(["connect", "query", "end"])
  })

  it("checks existence with a parameter, not by pasting the name into SQL", async () => {
    const { client, queries } = fakeClient()
    const server = await connect(client)
    expect(await server.exists("there")).toBe(true)
    expect(await server.exists("gone")).toBe(false)
    expect(queries[0]).toEqual({
      text: "SELECT 1 FROM pg_database WHERE datname = $1",
      values: ["there"],
    })
  })

  it("quotes identifiers in every statement", async () => {
    const { client, queries } = fakeClient()
    const server = await connect(client)
    await server.createFromTemplate('evil"; DROP DATABASE prod; --', "staging")
    await server.create("a b")
    await server.rename("pp_incoming", "pp")
    expect(queries.map((q) => q.text)).toEqual([
      'CREATE DATABASE "evil""; DROP DATABASE prod; --" TEMPLATE "staging"',
      'CREATE DATABASE "a b"',
      'ALTER DATABASE "pp_incoming" RENAME TO "pp"',
    ])
  })

  it("reports a template in use as busy (#1057)", async () => {
    const { client } = fakeClient([{ match: /TEMPLATE/, errors: [IN_USE] }])
    expect(await (await connect(client)).createFromTemplate("pp", "staging")).toBe("busy")
  })

  it("rethrows any other template failure", async () => {
    const { client } = fakeClient([
      { match: /TEMPLATE/, errors: [{ code: "42501", message: "permission denied" }] },
    ])
    await expect((await connect(client)).createFromTemplate("pp", "staging")).rejects.toThrow(
      "permission denied",
    )
  })

  it("disconnects only the dropped database's clients, then drops it", async () => {
    const { client, queries } = fakeClient()
    await (await connect(client)).drop("pp_pr_748")
    expect(queries).toEqual([
      {
        text: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        values: ["pp_pr_748"],
      },
      { text: 'DROP DATABASE IF EXISTS "pp_pr_748"', values: undefined },
    ])
  })

  it("disconnects again and retries when a client reconnects before the drop", async () => {
    const { client, queries } = fakeClient([{ match: /^DROP/, errors: [IN_USE, IN_USE] }])
    await (await connect(client)).drop("pp")
    expect(queries.filter((q) => q.text.includes("pg_terminate_backend"))).toHaveLength(3)
    expect(queries.filter((q) => q.text.startsWith("DROP"))).toHaveLength(3)
  })

  it("gives up after five attempts", async () => {
    const { client, queries } = fakeClient([{ match: /^DROP/, errors: Array(9).fill(IN_USE) }])
    await expect((await connect(client)).drop("pp")).rejects.toThrow(/being accessed/)
    expect(queries.filter((q) => q.text.startsWith("DROP"))).toHaveLength(5)
  })

  it("doesn't retry a drop that fails for another reason", async () => {
    const { client, queries } = fakeClient([
      { match: /^DROP/, errors: [{ code: "42501", message: "must be owner" }] },
    ])
    await expect((await connect(client)).drop("pp")).rejects.toThrow("must be owner")
    expect(queries.filter((q) => q.text.startsWith("DROP"))).toHaveLength(1)
  })
})

describe("external commands", () => {
  // Each fake appends its arguments (and, for pnpm, DATABASE_URI) to $LOG, then behaves as
  // the variables below say. pg_restore saves what it was piped to $RESTORED.
  const FAKES = {
    pg_dump: `#!/bin/sh
echo "pg_dump $*" >> "$LOG"
if [ -n "$DUMP_BYTES" ]; then head -c "$DUMP_BYTES" /dev/zero; else printf 'PGDMP-custom-archive'; fi
exit "\${DUMP_STATUS:-0}"
`,
    pg_restore: `#!/bin/sh
echo "pg_restore $*" >> "$LOG"
if [ -n "$RESTORE_STATUS" ]; then exit "$RESTORE_STATUS"; fi
cat > "$RESTORED"
`,
    pnpm: `#!/bin/sh
echo "pnpm $* DATABASE_URI=$DATABASE_URI" >> "$LOG"
exit "\${MIGRATE_STATUS:-0}"
`,
  }
  const saved = { ...process.env }
  let dir: string
  const log = () => readFileSync(join(dir, "log"), "utf-8").trim().split("\n")

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "preview-database-bin-"))
    mkdirSync(join(dir, "bin"))
    for (const [name, body] of Object.entries(FAKES)) {
      writeFileSync(join(dir, "bin", name), body)
      chmodSync(join(dir, "bin", name), 0o755)
    }
    Object.assign(process.env, {
      PATH: `${join(dir, "bin")}:${saved.PATH}`,
      LOG: join(dir, "log"),
      RESTORED: join(dir, "restored"),
    })
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
    rmSync(dir, { recursive: true, force: true })
  })

  it("pipes pg_dump's custom-format archive straight into pg_restore", async () => {
    await dumpRestore(STAGING, "postgresql://pp:pw@db:5432/pp_pr_748")
    expect(readFileSync(join(dir, "restored"), "utf-8")).toBe("PGDMP-custom-archive")
    expect(log()).toEqual([
      `pg_dump --format=custom --no-owner --no-acl --dbname=${STAGING}`,
      "pg_restore --no-owner --no-acl --dbname=postgresql://pp:pw@db:5432/pp_pr_748",
    ])
  })

  it("fails when pg_dump fails, even though pg_restore succeeded", async () => {
    process.env.DUMP_STATUS = "1"
    await expect(dumpRestore(STAGING, BASE)).rejects.toThrow("pg_dump exited with 1")
  })

  it("fails when pg_restore fails", async () => {
    process.env.RESTORE_STATUS = "2"
    await expect(dumpRestore(STAGING, BASE)).rejects.toThrow("pg_restore exited with 2")
  })

  it("fails cleanly when pg_restore quits while pg_dump is still writing", async () => {
    process.env.RESTORE_STATUS = "2"
    process.env.DUMP_BYTES = String(8 * 1024 * 1024)
    await expect(dumpRestore(STAGING, BASE)).rejects.toThrow(/exited with/)
  })

  it("fails when pg_dump isn't installed", async () => {
    process.env.PATH = join(dir, "missing")
    await expect(dumpRestore(STAGING, BASE)).rejects.toThrow(/ENOENT/)
  })

  it("runs payload migrate against the given database", async () => {
    await migrate("postgresql://pp:pw@db:5432/pp_pr_748_incoming")
    expect(log()).toEqual([
      "pnpm payload migrate DATABASE_URI=postgresql://pp:pw@db:5432/pp_pr_748_incoming",
    ])
  })

  it("fails when payload migrate fails", async () => {
    process.env.MIGRATE_STATUS = "3"
    await expect(migrate(BASE)).rejects.toThrow("payload migrate exited with 3")
  })
})

describe("main", () => {
  const PREVIEW = {
    BUILD_ENV: "preview",
    COOLIFY_FQDN: "pr-9.example.com",
    DATABASE_URI: BASE,
    COPY_SOURCE_DATABASE: "true",
    SOURCE_DATABASE_URI: "postgresql://pp:pw@db:5432/staging",
  }
  const PREVIEW_URI = "postgresql://pp:pw@db:5432/pragmatic_papers_pr_9?sslmode=require"
  let dir: string
  let envFile: string
  let output: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "preview-database-"))
    envFile = join(dir, "database_uri.env")
    output = ""
    const capture = (chunk: unknown) => {
      output += String(chunk)
      return true
    }
    vi.spyOn(process.stdout, "write").mockImplementation(capture)
    vi.spyOn(console, "error").mockImplementation((message: unknown) => capture(`${message}\n`))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  /** Deps whose server is `fake`, recording what main connected to and whether it closed. */
  function deps(fake = fakeServer(), overrides: Partial<MainDeps> = {}) {
    const record = { connectedTo: [] as string[], closed: 0 }
    const result: MainDeps = {
      async connect(uri) {
        record.connectedTo.push(uri)
        return {
          ...fake.server,
          async close() {
            record.closed++
          },
        }
      },
      async dumpRestore() {
        fake.calls.push("dump")
      },
      async migrate() {
        fake.calls.push("migrate")
      },
      ...overrides,
    }
    return { deps: result, record, ...fake }
  }

  it("writes the resolved URI for later build steps and skips the copy when it's off", async () => {
    const { deps: d, record } = deps()
    const status = await main({ ...PREVIEW, COPY_SOURCE_DATABASE: "" }, envFile, d)
    expect(status).toBe(0)
    expect(readFileSync(envFile, "utf-8")).toBe(`export DATABASE_URI='${PREVIEW_URI}'\n`)
    expect(record.connectedTo).toEqual([])
  })

  it("copies into the preview's own database and closes the connection", async () => {
    const { deps: d, record, calls } = deps()
    expect(await main(PREVIEW, envFile, d)).toBe(0)
    expect(record).toEqual({ connectedTo: [PREVIEW_URI], closed: 1 })
    expect(calls).toEqual(["template staging -> pragmatic_papers_pr_9"])
    expect(output).toContain("Database ready")
  })

  it("never prints a password", async () => {
    const { deps: d } = deps()
    await main(PREVIEW, envFile, d)
    expect(output).toContain("postgresql://pp:****@db:5432/pragmatic_papers_pr_9")
    expect(output).not.toMatch(/:pw@/)
  })

  it("forces a recopy only when FORCE_DATABASE_COPY is exactly true", async () => {
    const existing = ["pragmatic_papers_pr_9"]
    const loose = deps(fakeServer({ existing }))
    await main({ ...PREVIEW, FORCE_DATABASE_COPY: "1" }, envFile, loose.deps)
    expect(loose.calls).toEqual([])

    const forced = deps(fakeServer({ existing }))
    await main({ ...PREVIEW, FORCE_DATABASE_COPY: "true" }, envFile, forced.deps)
    expect(forced.calls).toContain("migrate")
  })

  it("closes the connection when the copy fails, and exits 1", async () => {
    const { deps: d, record } = deps(fakeServer({ existing: ["pragmatic_papers_pr_9"] }), {
      migrate: () => Promise.reject(new Error("payload migrate exited with 1")),
    })
    expect(await main({ ...PREVIEW, FORCE_DATABASE_COPY: "true" }, envFile, d)).toBe(1)
    expect(record.closed).toBe(1)
    expect(output).toContain("ERROR: payload migrate exited with 1")
  })

  it("requires SOURCE_DATABASE_URI when copying, before connecting", async () => {
    const { deps: d, record } = deps()
    expect(await main({ ...PREVIEW, SOURCE_DATABASE_URI: "" }, envFile, d)).toBe(1)
    expect(output).toContain("ERROR: SOURCE_DATABASE_URI is not set")
    expect(record.connectedTo).toEqual([])
  })

  it("exits 1 when it can't connect", async () => {
    const { deps: d } = deps(fakeServer(), {
      connect: () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.5:5432")),
    })
    expect(await main(PREVIEW, envFile, d)).toBe(1)
    expect(output).toContain("ERROR: connect ECONNREFUSED")
  })

  it("fails without printing the password", async () => {
    expect(await main({ BUILD_ENV: "preview", DATABASE_URI: BASE }, envFile)).toBe(1)
    expect(output).toContain("COOLIFY_FQDN is not set")
    expect(output).not.toMatch(/:pw@/)
  })
})

describe("the entry point", () => {
  // The Dockerfile runs the file with plain `node`, which only strips types: syntax it
  // can't strip (enums, parameter properties…) would break every build, and no import of
  // the module in Vitest would notice.
  it("runs under plain node and exits 1 on a bad configuration", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf-8",
      env: { ...process.env, BUILD_ENV: "preview", COOLIFY_FQDN: "", DATABASE_URI: BASE },
    })
    expect(result.stderr).toContain("ERROR: COOLIFY_FQDN is not set")
    expect(result.status).toBe(1)
  })
})
