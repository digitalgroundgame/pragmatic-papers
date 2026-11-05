// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"

import ts from "typescript"
import { describe, expect, it } from "vitest"

interface WorkerConfig {
  name: string
  vars?: Record<string, string>
}
type WranglerConfig = WorkerConfig & { env?: Record<string, WorkerConfig> }

function readWrangler(): WranglerConfig {
  const path = join(process.cwd(), "wrangler.jsonc")
  // TypeScript's JSON reader allows the comments and trailing commas wrangler.jsonc has.
  const { config, error } = ts.parseConfigFileTextToJson(path, readFileSync(path, "utf8"))
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"))
  return config as WranglerConfig
}

const wrangler = readWrangler()
// An environment doesn't inherit the top-level `vars`, so each Worker is checked on its own.
const workers: [string, WorkerConfig][] = [
  [wrangler.name, wrangler],
  ...Object.values(wrangler.env ?? {}).map((env): [string, WorkerConfig] => [env.name, env]),
]

describe("wrangler.jsonc", () => {
  it("has a production Worker", () => {
    expect(workers.map(([name]) => name)).toContain("pragmatic-papers-production")
  })

  // The Coolify app's deploy seeds each database; a Worker reading the same database must
  // never seed it too.
  it.each(workers)("%s never seeds its database on deploy", (_name, worker) => {
    expect(worker.vars?.DEPLOY_SEED).toBe("false")
  })

  // Coolify production renders these from its own variables; without them the Worker's
  // pages link media to /api/media/file (which production doesn't serve), skip analytics
  // and show the signup form with no challenge.
  it("gives the production Worker S3 media, analytics and Turnstile's site key", () => {
    const production = workers.find(([name]) => name === "pragmatic-papers-production")![1]
    expect(production.vars?.USE_LOCAL_STORAGE).toBe("false")
    expect(production.vars?.GOOGLE_ANALYTICS_ID).toMatch(/^G-[A-Z0-9]+$/)
    expect(production.vars?.TURNSTILE_SITE_KEY).toMatch(/^0x[A-Za-z0-9_-]+$/)
  })

  it("keeps staging's Worker on local storage", () => {
    expect(wrangler.vars?.USE_LOCAL_STORAGE).toBe("true")
  })
})

describe("worker.yml", () => {
  // OpenNext compiles .env files into the Worker as fallbacks for unset bindings, and
  // setup-project writes one for CI's tests (USE_LOCAL_STORAGE=true, a localhost database).
  it("deletes setup-project's .env before building the Worker", () => {
    const steps = readFileSync(join(process.cwd(), ".github/workflows/worker.yml"), "utf8")
      .split("\n")
      .map((line) => line.trim())
    const setup = steps.indexOf("uses: ./.github/actions/setup-project")
    const remove = steps.indexOf("run: rm -f .env")
    const build = steps.indexOf("run: pnpm build:worker")
    expect(setup).toBeGreaterThan(-1)
    expect(remove).toBeGreaterThan(setup)
    expect(build).toBeGreaterThan(remove)
  })
})
