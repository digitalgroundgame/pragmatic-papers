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

  // Unset, the Worker would read a stray build-time .env's value (OpenNext compiles .env
  // files in as fallbacks) and link media to /api/media/file, which production doesn't serve.
  it("puts the production Worker's media on S3", () => {
    const production = workers.find(([name]) => name === "pragmatic-papers-production")![1]
    expect(production.vars?.USE_LOCAL_STORAGE).toBe("false")
  })

  it("keeps staging's Worker on local storage", () => {
    expect(wrangler.vars?.USE_LOCAL_STORAGE).toBe("true")
  })
})

describe("worker.yml", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/worker.yml"), "utf8")

  // Coolify production renders both from its own variables; without them the Worker's pages
  // skip analytics and show the signup form with no challenge.
  it.each([
    ["GOOGLE_ANALYTICS_ID", "PRODUCTION_GOOGLE_ANALYTICS_ID"],
    ["TURNSTILE_SITE_KEY", "PRODUCTION_TURNSTILE_SITE_KEY"],
  ])("gives the production Worker %s from the %s variable", (name, variable) => {
    expect(workflow).toContain(`${variable}: \${{ vars.${variable} }}`)
    expect(workflow).toContain(`--var "${name}:$${variable}"`)
  })

  // OpenNext compiles .env files into the Worker as fallbacks for unset bindings, and
  // setup-project writes one for CI's tests (USE_LOCAL_STORAGE=true, a localhost database).
  it("deletes setup-project's .env before building the Worker", () => {
    const steps = workflow.split("\n").map((line) => line.trim())
    const setup = steps.indexOf("uses: ./.github/actions/setup-project")
    const remove = steps.indexOf("run: rm -f .env")
    const build = steps.indexOf("run: pnpm build:worker")
    expect(setup).toBeGreaterThan(-1)
    expect(remove).toBeGreaterThan(setup)
    expect(build).toBeGreaterThan(remove)
  })
})
