import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const SCRIPT = resolve(__dirname, "../../dockerfiles/scripts/copy-database.sh")

// Every fake appends one line to $LOG. psql answers the existence check from
// $TARGET_EXISTS and refuses a template copy while $SOURCE_BUSY is set, as Postgres
// does while anything is connected to the template.
const FAKES = {
  psql: `#!/bin/sh
echo "psql $*" >> "$LOG"
case "$*" in
  *"FROM pg_database"*) [ -n "$TARGET_EXISTS" ] && echo 1; exit 0 ;;
  *"WITH TEMPLATE"*)
    if [ -n "$SOURCE_BUSY" ]; then echo 'ERROR:  source database "staging" is being accessed by other users' >&2; exit 1; fi ;;
esac
exit 0
`,
  pg_dump: `#!/bin/sh
echo "pg_dump $*" >> "$LOG"
`,
  pg_restore: `#!/bin/sh
cat > /dev/null
echo "pg_restore $*" >> "$LOG"
`,
  pnpm: `#!/bin/sh
echo "pnpm $* on $DATABASE_URI" >> "$LOG"
exit "\${MIGRATE_STATUS:-0}"
`,
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "copy-database-"))
  mkdirSync(join(dir, "bin"))
  for (const [name, body] of Object.entries(FAKES)) {
    writeFileSync(join(dir, "bin", name), body)
    chmodSync(join(dir, "bin", name), 0o755)
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function copy(env: Record<string, string> = {}) {
  const result = spawnSync("sh", [SCRIPT], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      LOG: join(dir, "log"),
      COPY_SOURCE_DATABASE: "true",
      FORCE_DATABASE_COPY: "",
      SOURCE_DATABASE_URI: "postgresql://pp:pw@db:5432/staging",
      DATABASE_URI: "postgresql://pp:pw@db:5432/pp_pr_748",
      ...env,
    },
  })
  let log: string[] = []
  try {
    log = readFileSync(join(dir, "log"), "utf-8").trim().split("\n")
  } catch {}
  return { status: result.status, output: result.stdout + result.stderr, log }
}

describe("copy-database.sh", () => {
  it("does nothing unless COPY_SOURCE_DATABASE is true", () => {
    expect(copy({ COPY_SOURCE_DATABASE: "" })).toMatchObject({ status: 0, log: [] })
  })

  it("copies an idle source with a template", () => {
    const { status, log } = copy()
    expect(status).toBe(0)
    expect(log.join("\n")).toContain('CREATE DATABASE "pp_pr_748" WITH TEMPLATE "staging"')
    expect(log.join("\n")).not.toContain("pg_dump")
  })

  it("falls back to dump/restore rather than disconnecting a busy source (#1057)", () => {
    const { status, log } = copy({ SOURCE_BUSY: "1" })
    expect(status).toBe(0)
    expect(log.join("\n")).not.toContain("pg_terminate_backend")
    expect(log.some((line) => line.startsWith("pg_dump") && line.includes("-d staging"))).toBe(true)
    expect(log.some((line) => line.startsWith("pg_restore") && line.includes("-d pp_pr_748"))).toBe(
      true,
    )
  })

  it("leaves an existing target alone without FORCE_DATABASE_COPY", () => {
    const { status, log } = copy({ TARGET_EXISTS: "1" })
    expect(status).toBe(0)
    expect(log.join("\n")).not.toMatch(/DROP|CREATE/)
  })

  it("migrates a forced copy beside the live target before swapping it in (#1058)", () => {
    const { status, log } = copy({ TARGET_EXISTS: "1", FORCE_DATABASE_COPY: "true" })
    expect(status).toBe(0)
    const step = (text: string) => log.findIndex((line) => line.includes(text))
    const copied = step('CREATE DATABASE "pp_pr_748_incoming" WITH TEMPLATE "staging"')
    const migrated = step("pnpm payload migrate on postgresql://pp:pw@db:5432/pp_pr_748_incoming")
    const dropped = step('DROP DATABASE IF EXISTS "pp_pr_748";')
    const renamed = step('ALTER DATABASE "pp_pr_748_incoming" RENAME TO "pp_pr_748"')
    expect(copied).toBeGreaterThan(-1)
    expect(migrated).toBeGreaterThan(copied)
    expect(dropped).toBeGreaterThan(migrated)
    expect(renamed).toBeGreaterThan(dropped)
    expect(log.join("\n")).not.toContain("datname = 'staging'")
  })

  it("keeps the live target when the forced copy fails to migrate", () => {
    const { status, log } = copy({
      TARGET_EXISTS: "1",
      FORCE_DATABASE_COPY: "true",
      MIGRATE_STATUS: "1",
    })
    expect(status).not.toBe(0)
    expect(log.join("\n")).not.toContain('DROP DATABASE IF EXISTS "pp_pr_748";')
  })
})
