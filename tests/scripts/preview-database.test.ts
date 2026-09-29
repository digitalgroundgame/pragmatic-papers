import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const SCRIPTS = resolve(__dirname, "../../dockerfiles/scripts")
const PASSWORD = "hunter2-s3cret"
const URI = `postgres://app:${PASSWORD}@db.internal:5432/pragmatic_papers?sslmode=require`
const PREVIEW_URI = URI.replace("pragmatic_papers?", "pragmatic_papers_pr_330?")

// Fake psql, pg_dump, pg_restore, pnpm and node. Each logs its name and arguments to
// $CALLS_LOG, one line per call. psql answers the "does the target exist?" query from
// $TARGET_EXISTS and, while $SOURCE_BUSY is set, refuses a template copy the way Postgres
// does while anything is connected to the template. pnpm also logs the DATABASE_URI it
// migrated. $DUMP_STATUS, $RESTORE_STATUS and $MIGRATE_STATUS make those steps fail.
const FAKES: Record<string, string> = {
  psql: `case "$*" in
  *"FROM pg_database"*) [ "$TARGET_EXISTS" = "true" ] && echo 1 ;;
  *"WITH TEMPLATE"*) if [ "$SOURCE_BUSY" = "true" ]; then
    echo 'ERROR:  source database "pragmatic_papers" is being accessed by other users' >&2; exit 1; fi ;;
esac
exit 0`,
  pg_dump: `for arg; do case "$arg" in --file=*) : > "\${arg#--file=}" ;; esac; done
exit "\${DUMP_STATUS:-0}"`,
  pg_restore: `exit "\${RESTORE_STATUS:-0}"`,
  pnpm: `echo "migrated DATABASE_URI=$DATABASE_URI" >> "$CALLS_LOG"
exit "\${MIGRATE_STATUS:-0}"`,
  node: `[ "$1" = "--version" ] && echo v24 && exit 0
echo "node started with DATABASE_URI=$DATABASE_URI"`,
}
const LOG_CALL = `echo "$(basename "$0") $*" | tr '\\n' ' ' >> "$CALLS_LOG"; echo >> "$CALLS_LOG"`

let dir: string
let nameFile: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "preview-database-"))
  nameFile = join(dir, "database_name")
  mkdirSync(join(dir, "bin"))
  for (const [name, body] of Object.entries(FAKES)) {
    writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${LOG_CALL}\n${body}\n`)
    chmodSync(join(dir, "bin", name), 0o755)
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// Runs `script` in sh with the helpers sourced, the way the Dockerfile's RUN steps do.
function sh(script: string, env: Record<string, string> = {}) {
  const result = spawnSync("sh", ["-c", `. "${SCRIPTS}/database-uri.sh"; ${script}`], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      CALLS_LOG: join(dir, "calls.log"),
      DATABASE_NAME_FILE: nameFile,
      SOURCE_DATABASE_NAME: "",
      COPY_SOURCE_DATABASE: "",
      FORCE_DATABASE_COPY: "",
      TARGET_EXISTS: "",
      SOURCE_BUSY: "",
      ...env,
    },
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

const calls = () => readFileSync(join(dir, "calls.log"), "utf-8").trim().split("\n")

describe("database-uri.sh", () => {
  it("redacts only the password", () => {
    expect(sh(`redact_uri "${URI}"`).output.trim()).toBe(
      "postgres://app:****@db.internal:5432/pragmatic_papers?sslmode=require",
    )
    expect(sh(`redact_uri "postgres://db.internal/pp"`).output.trim()).toBe(
      "postgres://db.internal/pp",
    )
  })

  it("swaps the database and keeps the options", () => {
    expect(sh(`uri_database "${URI}"`).output.trim()).toBe("pragmatic_papers")
    expect(sh(`uri_with_database "${URI}" other`).output.trim()).toBe(
      `postgres://app:${PASSWORD}@db.internal:5432/other?sslmode=require`,
    )
  })

  it("use_preview_database leaves DATABASE_URI alone when no name was written", () => {
    writeFileSync(nameFile, "")
    const { output } = sh(
      `use_preview_database "${nameFile}"; echo "$DATABASE_URI|$SOURCE_DATABASE_NAME"`,
      { DATABASE_URI: URI },
    )
    expect(output.trim()).toBe(`${URI}|`)
  })
})

describe("preview database build", () => {
  const preview = { BUILD_ENV: "preview", COOLIFY_FQDN: "pr-330.pragmaticpapers.com" }

  it("names the preview database without writing or printing the password", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/modify-database-uri.sh"`, {
      ...preview,
      DATABASE_URI: URI,
    })

    expect(status).toBe(0)
    expect(readFileSync(nameFile, "utf-8").trim()).toBe("pragmatic_papers_pr_330")
    expect(output).not.toContain(PASSWORD)
    expect(output).toContain("postgres://app:****@db.internal:5432/pragmatic_papers_pr_330")
  })

  it("writes an empty name outside previews", () => {
    writeFileSync(nameFile, "stale_name")
    const { status, output } = sh(`sh "${SCRIPTS}/modify-database-uri.sh"`, {
      BUILD_ENV: "staging",
      DATABASE_URI: URI,
    })

    expect(status).toBe(0)
    expect(readFileSync(nameFile, "utf-8")).toBe("")
    expect(output).not.toContain(PASSWORD)
  })

  it("copies the original database into the preview database", () => {
    const { status, output } = sh(
      `sh "${SCRIPTS}/modify-database-uri.sh" && use_preview_database "${nameFile}" && ` +
        `echo "URI=$DATABASE_URI" && sh "${SCRIPTS}/copy-database.sh"`,
      { ...preview, DATABASE_URI: URI, COPY_SOURCE_DATABASE: "true" },
    )

    expect(status).toBe(0)
    expect(output).toContain(`URI=${PREVIEW_URI}`)
    expect(output.replace(/^URI=.*$/m, "")).not.toContain(PASSWORD)
    const create = calls().at(-1)
    expect(create).toContain(
      'CREATE DATABASE "pragmatic_papers_pr_330" WITH TEMPLATE "pragmatic_papers"',
    )
    // Connects to the server's maintenance database, not either copy.
    expect(create).toMatch(
      /^psql postgres:\/\/app:.*@db\.internal:5432\/postgres\?sslmode=require /,
    )
  })

  it("leaves an existing preview database alone", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/copy-database.sh"`, {
      DATABASE_URI: PREVIEW_URI,
      SOURCE_DATABASE_NAME: "pragmatic_papers",
      COPY_SOURCE_DATABASE: "true",
      TARGET_EXISTS: "true",
    })

    expect(status).toBe(0)
    expect(output).toContain("already exists")
    expect(calls()).toHaveLength(1)
  })

  it("fails a preview that can't name its database instead of sharing one (#1058)", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/modify-database-uri.sh"`, {
      BUILD_ENV: "preview",
      COOLIFY_FQDN: "",
      DATABASE_URI: URI,
    })

    expect(status).toBe(1)
    expect(output).toContain("COOLIFY_FQDN is not set")
    expect(readFileSync(nameFile, "utf-8")).toBe("")
  })

  const copyToPreview = (env: Record<string, string> = {}) =>
    sh(`sh "${SCRIPTS}/copy-database.sh"`, {
      DATABASE_URI: PREVIEW_URI,
      SOURCE_DATABASE_NAME: "pragmatic_papers",
      COPY_SOURCE_DATABASE: "true",
      ...env,
    })
  // Any statement that disconnects clients of the source database.
  const disconnectsSource = () =>
    calls().some(
      (call) => call.includes("pg_terminate_backend") && call.includes("'pragmatic_papers'"),
    )
  const indexOf = (text: string) => calls().findIndex((call) => call.includes(text))

  it("falls back to dump/restore rather than disconnecting a busy source (#1057)", () => {
    const { status, output } = copyToPreview({ SOURCE_BUSY: "true" })

    expect(status).toBe(0)
    expect(output).toContain("falling back to dump/restore")
    expect(output).not.toContain(PASSWORD)
    expect(disconnectsSource()).toBe(false)
    expect(calls()).toContainEqual(
      expect.stringMatching(
        /^pg_dump .*--dbname=postgres:\/\/app:.*\/pragmatic_papers\?sslmode=require/,
      ),
    )
    expect(calls()).toContainEqual(
      expect.stringMatching(
        /^pg_restore .*--dbname=postgres:\/\/app:.*\/pragmatic_papers_pr_330\?sslmode=require/,
      ),
    )
  })

  it.each([
    ["pg_dump", { DUMP_STATUS: "1" }],
    ["pg_restore", { RESTORE_STATUS: "1" }],
  ])("drops the half-restored copy when %s fails, so the next build copies again", (_, env) => {
    const { status, output } = copyToPreview({ SOURCE_BUSY: "true", ...env })

    expect(status).toBe(1)
    expect(output).toContain("pg_dump/pg_restore failed")
    expect(calls().at(-1)).toContain('DROP DATABASE IF EXISTS "pragmatic_papers_pr_330"')
  })

  it("migrates a forced copy beside the live one before swapping it in (#1058)", () => {
    const { status, output } = copyToPreview({ TARGET_EXISTS: "true", FORCE_DATABASE_COPY: "true" })

    expect(status).toBe(0)
    expect(output).not.toContain(PASSWORD)
    const steps = [
      'DROP DATABASE IF EXISTS "pragmatic_papers_pr_330_incoming"',
      'CREATE DATABASE "pragmatic_papers_pr_330_incoming" WITH TEMPLATE "pragmatic_papers"',
      "migrated DATABASE_URI=postgres://app:hunter2-s3cret@db.internal:5432/pragmatic_papers_pr_330_incoming?sslmode=require",
      'DROP DATABASE IF EXISTS "pragmatic_papers_pr_330";',
      'ALTER DATABASE "pragmatic_papers_pr_330_incoming" RENAME TO "pragmatic_papers_pr_330"',
    ].map(indexOf)
    expect(steps.every((step) => step >= 0)).toBe(true)
    expect(steps).toEqual([...steps].sort((a, b) => a - b))
    expect(disconnectsSource()).toBe(false)
  })

  it("keeps the live preview database when the forced copy fails to migrate", () => {
    const { status } = copyToPreview({
      TARGET_EXISTS: "true",
      FORCE_DATABASE_COPY: "true",
      MIGRATE_STATUS: "1",
    })

    expect(status).not.toBe(0)
    expect(indexOf('DROP DATABASE IF EXISTS "pragmatic_papers_pr_330";')).toBe(-1)
  })

  it("never copies onto a database that isn't a preview's", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/copy-database.sh"`, {
      DATABASE_URI: URI,
      COPY_SOURCE_DATABASE: "true",
    })

    expect(status).toBe(0)
    expect(output).toContain("isn't a preview database")
  })
})

describe("start.sh", () => {
  // Lays out /app as the runner image does: start.sh, the helpers and the name file.
  function start(name: string, env: Record<string, string>) {
    const app = join(dir, "app")
    mkdirSync(app)
    copyFileSync(join(SCRIPTS, "start.sh"), join(app, "start.sh"))
    copyFileSync(join(SCRIPTS, "database-uri.sh"), join(app, "database-uri.sh"))
    writeFileSync(join(app, "database_name"), name)
    return sh(`cd "${app}" && sh ./start.sh`, env)
  }

  it("points a preview at its own database", () => {
    const { status, output } = start("pragmatic_papers_pr_330\n", { DATABASE_URI: URI })

    expect(status).toBe(0)
    expect(output).toContain(`node started with DATABASE_URI=${PREVIEW_URI}`)
  })

  it("uses DATABASE_URI as-is outside previews", () => {
    const { status, output } = start("", { DATABASE_URI: URI })

    expect(status).toBe(0)
    expect(output).toContain(`node started with DATABASE_URI=${URI}`)
  })

  it("refuses to start without a runtime DATABASE_URI", () => {
    const { status, output } = start("pragmatic_papers_pr_330\n", { DATABASE_URI: "" })

    expect(status).toBe(1)
    expect(output).toContain("DATABASE_URI is not set at runtime")
    expect(output).not.toContain("node started")
  })
})
