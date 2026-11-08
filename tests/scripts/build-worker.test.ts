import { spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "../..")
const SCRIPT = join(ROOT, "scripts/build-worker.mjs")

// Logs each call with the environment the build reads and whether the admin folder is
// there, then exits with $FAIL_ON's status when its arguments contain that word.
const FAKE_PNPM = `#!/bin/sh
admin=absent
[ -d "src/app/(payload)" ] && admin=present
echo "$* | OPENNEXT_BUILD=$OPENNEXT_BUILD SKIP_BUILD_TYPE_CHECK=$SKIP_BUILD_TYPE_CHECK admin=$admin" >> calls.log
case "$*" in *opennextjs-cloudflare*) mkdir -p .open-next/assets ;; esac
if [ -n "$FAIL_ON" ]; then case "$*" in *"$FAIL_ON"*) exit 1 ;; esac; fi
exit 0
`

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "build-worker-"))
  mkdirSync(join(dir, "bin"))
  writeFileSync(join(dir, "bin/pnpm"), FAKE_PNPM)
  chmodSync(join(dir, "bin/pnpm"), 0o755)
  mkdirSync(join(dir, "src/app/(payload)/admin"), { recursive: true })
  writeFileSync(join(dir, "src/app/(payload)/admin/page.tsx"), "")
  mkdirSync(join(dir, "src/cloudflare"), { recursive: true })
  writeFileSync(join(dir, "src/cloudflare/_headers"), "/_next/static/*\n")
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function build(env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir,
    encoding: "utf-8",
    env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}`, ...env },
  })
  const log = join(dir, "calls.log")
  return {
    status: result.status,
    calls: existsSync(log) ? readFileSync(log, "utf-8").trim().split("\n") : [],
    adminBack: existsSync(join(dir, "src/app/(payload)/admin/page.tsx")),
  }
}

describe("build-worker.mjs", () => {
  it("builds with webpack and without the admin folder, skipping Next's type check", () => {
    const result = build()
    expect(result.status).toBe(0)
    expect(result.calls).toEqual([
      "exec next build --webpack | OPENNEXT_BUILD=true SKIP_BUILD_TYPE_CHECK=true admin=absent",
      "exec opennextjs-cloudflare build --skipNextBuild | OPENNEXT_BUILD=true SKIP_BUILD_TYPE_CHECK= admin=absent",
    ])
    expect(result.adminBack).toBe(true)
    expect(readFileSync(join(dir, ".open-next/assets/_headers"), "utf-8")).toBe("/_next/static/*\n")
  })

  it("puts the admin folder back when the build fails", () => {
    const result = build({ FAIL_ON: "next build" })
    expect(result.status).not.toBe(0)
    expect(result.calls).toHaveLength(1)
    expect(result.adminBack).toBe(true)
  })
})

describe("worker-build.yml", () => {
  const workflow = readFileSync(join(ROOT, ".github/workflows/worker-build.yml"), "utf-8")

  it.each([
    "package.json",
    "pnpm-lock.yaml",
    "next.config.ts",
    "open-next.config.ts",
    "wrangler.jsonc",
    "scripts/build-worker.mjs",
    "src/cloudflare/**",
  ])("runs on a PR that changes %s", (path) => {
    expect(workflow).toContain(`      - ${path}\n`)
  })

  it("builds the Worker the way worker.yml does, and deploys nothing", () => {
    expect(workflow).toContain("run: pnpm build:worker")
    expect(workflow).toContain("run: rm -f .env")
    expect(workflow).not.toMatch(
      /CLOUDFLARE_API_TOKEN|opennextjs-cloudflare deploy|wrangler deploy(?! --dry-run)/,
    )
  })
})
