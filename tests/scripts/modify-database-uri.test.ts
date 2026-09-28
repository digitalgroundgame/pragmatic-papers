import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const SCRIPT = resolve(__dirname, "../../dockerfiles/scripts/modify-database-uri.sh")
// The script's output path is fixed; the runner stage copies it from there.
const ENV_FILE = "/tmp/database_uri.env"

afterEach(() => {
  rmSync(ENV_FILE, { force: true })
})

function modify(env: Record<string, string>) {
  rmSync(ENV_FILE, { force: true })
  const result = spawnSync("sh", [SCRIPT], {
    encoding: "utf-8",
    env: {
      ...process.env,
      BUILD_ENV: "",
      COOLIFY_FQDN: "",
      DATABASE_URI: "postgresql://pp:pw@db:5432/pragmatic_papers",
      ...env,
    },
  })
  return {
    status: result.status,
    output: result.stdout + result.stderr,
    written: existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf-8").trim() : undefined,
  }
}

describe("modify-database-uri.sh", () => {
  it("keeps DATABASE_URI outside previews", () => {
    expect(modify({ BUILD_ENV: "staging" })).toMatchObject({
      status: 0,
      written: "export DATABASE_URI='postgresql://pp:pw@db:5432/pragmatic_papers'",
    })
  })

  it("gives a preview its own database, named after its host", () => {
    expect(
      modify({ BUILD_ENV: "preview", COOLIFY_FQDN: "pr-748.pragmaticpapers.com" }),
    ).toMatchObject({
      status: 0,
      written: "export DATABASE_URI='postgresql://pp:pw@db:5432/pragmatic_papers_pr_748'",
    })
  })

  it("fails a preview that can't name its database instead of sharing one (#1058)", () => {
    const { status, output, written } = modify({ BUILD_ENV: "preview" })
    expect(status).toBe(1)
    expect(output).toContain("COOLIFY_FQDN is not set")
    expect(written).toBeUndefined()
  })
})
