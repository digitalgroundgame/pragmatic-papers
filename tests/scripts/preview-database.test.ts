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

// Fake psql and node. Each logs its name and arguments to $CALLS_LOG, one line per
// call. psql answers the "does the target exist?" query from $TARGET_EXISTS.
const FAKES: Record<string, string> = {
  psql: `case "$*" in *"FROM pg_database"*) [ "$TARGET_EXISTS" = "true" ] && echo 1 ;; esac
exit 0`,
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
