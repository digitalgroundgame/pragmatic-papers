import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  copyDatabase,
  databaseName,
  envFileLine,
  main,
  maskUri,
  resolveDatabaseUri,
  type Server,
  withDatabase,
} from "../../dockerfiles/scripts/preview-database"

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
})

describe("resolveDatabaseUri", () => {
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

  it("keeps the live target when the forced copy fails to migrate", async () => {
    const { server, calls } = fakeServer({ existing: ["pp_pr_748"] })
    await expect(copy(server, calls, { force: true, migrateFails: true })).rejects.toThrow(
      /payload migrate/,
    )
    expect(calls).not.toContain("drop pp_pr_748")
  })
})

describe("main", () => {
  it("writes the resolved URI for later build steps and skips the copy when it's off", async () => {
    const dir = mkdtempSync(join(tmpdir(), "preview-database-"))
    try {
      const envFile = join(dir, "database_uri.env")
      const status = await main(
        { BUILD_ENV: "preview", COOLIFY_FQDN: "pr-9.example.com", DATABASE_URI: BASE },
        envFile,
      )
      expect(status).toBe(0)
      expect(readFileSync(envFile, "utf-8")).toBe(
        "export DATABASE_URI='postgresql://pp:pw@db:5432/pragmatic_papers_pr_9?sslmode=require'\n",
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("fails without printing the password", async () => {
    const errors: string[] = []
    const original = console.error
    console.error = (message: string) => errors.push(message)
    try {
      expect(await main({ BUILD_ENV: "preview", DATABASE_URI: BASE }, "/nonexistent/x")).toBe(1)
    } finally {
      console.error = original
    }
    expect(errors.join("\n")).toContain("COOLIFY_FQDN is not set")
    expect(errors.join("\n")).not.toContain(":pw@")
  })
})
