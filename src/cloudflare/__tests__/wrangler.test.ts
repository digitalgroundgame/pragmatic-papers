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
})
