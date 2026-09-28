import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const SCRIPTS = resolve(__dirname, "../../dockerfiles/scripts")
const PASSWORD = "hunter2-s3cret"
const URI = `postgres://app:${PASSWORD}@db.internal:5432/pragmatic_papers`

function run(script: string, env: Record<string, string>) {
  const result = spawnSync("sh", [resolve(SCRIPTS, script)], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

describe("database scripts keep passwords out of the build log", () => {
  it("modify-database-uri.sh redacts the original and modified URIs", () => {
    const { status, output } = run("modify-database-uri.sh", {
      BUILD_ENV: "preview",
      COOLIFY_FQDN: "pr-330.pragmaticpapers.com",
      DATABASE_URI: URI,
    })

    expect(status).toBe(0)
    expect(output).not.toContain(PASSWORD)
    expect(output).toContain("postgres://app:****@db.internal:5432/pragmatic_papers_pr_330")
    // The env file the next steps source still carries the real credentials.
    expect(readFileSync("/tmp/database_uri.env", "utf-8")).toContain(PASSWORD)
  })

  it("modify-database-uri.sh redacts the URI when it skips modification", () => {
    const { status, output } = run("modify-database-uri.sh", {
      BUILD_ENV: "production",
      DATABASE_URI: URI,
    })

    expect(status).toBe(0)
    expect(output).not.toContain(PASSWORD)
    expect(output).toContain("postgres://app:****@db.internal")
  })

  it("copy-database.sh redacts the source and target URIs", () => {
    // Same source and target, so the script stops before touching psql.
    const { status, output } = run("copy-database.sh", {
      COPY_SOURCE_DATABASE: "true",
      SOURCE_DATABASE_URI: URI,
      DATABASE_URI: URI,
    })

    expect(status).toBe(0)
    expect(output).not.toContain(PASSWORD)
    expect(output).toContain("Source Database: postgres://app:****@db.internal")
  })
})
