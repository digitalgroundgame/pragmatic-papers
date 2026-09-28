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

const SCRIPT = resolve(__dirname, "../../dockerfiles/scripts/build-next.sh")

// Each call to the fake `pnpm` takes the next comma-separated step from $SCENARIO:
// an exit code, or an error message to print before exiting 1.
const FAKE_PNPM = `#!/bin/sh
n=$(( $(cat "$CALLS" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$CALLS"
step=$(echo "$SCENARIO" | cut -d, -f"$n")
case "$step" in
  [0-9]*) exit "$step" ;;
  *) echo "Error [TurbopackInternalError]: $step" >&2; exit 1 ;;
esac
`

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "build-next-"))
  mkdirSync(join(dir, "bin"))
  writeFileSync(join(dir, "bin/pnpm"), FAKE_PNPM)
  chmodSync(join(dir, "bin/pnpm"), 0o755)
  mkdirSync(join(dir, ".next/cache/turbopack/v16"), { recursive: true })
  writeFileSync(join(dir, ".next/cache/turbopack/v16/00000116.meta"), "")
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function build(scenario: string) {
  const result = spawnSync("sh", [SCRIPT], {
    cwd: dir,
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      SCENARIO: scenario,
      CALLS: join(dir, "calls"),
    },
  })
  return {
    status: result.status,
    output: result.stdout + result.stderr,
    builds: Number(readFileSync(join(dir, "calls"), "utf-8")),
    cacheKept: existsSync(join(dir, ".next/cache/turbopack")),
  }
}

describe("build-next.sh", () => {
  it("builds once and keeps the cache when the build succeeds", () => {
    expect(build("0")).toMatchObject({ status: 0, builds: 1, cacheKept: true })
  })

  it.each([
    "Failed to restore data for task TaskId 3",
    "Failed to restore meta for task TaskId 3",
    "Failed to open database: CURRENT file is missing",
    "Cache corruption detected: checksum mismatch in block 4",
    "Unable to open static sorted file referenced from 00000116.meta",
  ])("clears the cache and rebuilds once on %j", (error) => {
    const result = build(`${error},0`)
    expect(result).toMatchObject({ status: 0, builds: 2, cacheKept: false })
    expect(result.output).toContain("Turbopack cache is corrupt")
  })

  it("fails when the rebuild fails too", () => {
    expect(build("Failed to restore data for task TaskId 3,1")).toMatchObject({
      status: 1,
      builds: 2,
    })
  })

  it("exits with the build's own status and no retry on any other error", () => {
    expect(build("2")).toMatchObject({ status: 2, builds: 1, cacheKept: true })
  })

  it("streams the build output", () => {
    expect(build("Failed to open database: x,0").output).toContain("Failed to open database: x")
  })
})
