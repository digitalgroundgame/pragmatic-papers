import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ReleaseLib from "../../scripts/release-lib"

// Replace the side-effecting helpers with spies; keep the pure exports (findVersion,
// releaseBranch, …) real so arg parsing and command building stay genuine.
const lib = vi.hoisted(() => ({
  run: vi.fn(),
  capture: vi.fn(() => "https://github.com/o/r/pull/1"),
  requireGh: vi.fn(),
  waitForMerge: vi.fn(),
  autoMergeAndWait: vi.fn(),
}))

vi.mock("../../scripts/release-lib", async (importOriginal) => ({
  ...(await importOriginal<typeof ReleaseLib>()),
  ...lib,
}))

// Mock fs so the version bump never touches the real package.json.
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => JSON.stringify({ version: "0.0.0" }, null, 2)),
  writeFileSync: vi.fn(),
}))

const fs = await import("node:fs")
const { main } = await import("../../scripts/release")

const realArgv = process.argv
const commands = () => lib.run.mock.calls.map((c) => c[0] as string)
const setArgv = (...args: string[]) => (process.argv = ["node", "release.ts", ...args])

beforeEach(() => {
  vi.clearAllMocks()
  lib.capture.mockReturnValue("https://github.com/o/r/pull/1")
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`)
  }) as never)
})

afterEach(() => {
  process.argv = realArgv
  vi.restoreAllMocks()
})

describe("release main()", () => {
  it("chains phase 1 into phase 2 by default, stopping before the tag", async () => {
    setArgv("1.0.0")
    await main()

    expect(lib.requireGh).toHaveBeenCalledOnce()

    const c = commands()
    // phase 1
    expect(c).toContain("git checkout -b chore/v1.0.0")
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce()
    const [, written] = vi.mocked(fs.writeFileSync).mock.calls[0] ?? []
    expect(String(written)).toContain('"version": "1.0.0"')
    expect(c).toContain('git commit -m "Bump package.json to v1.0.0"')
    expect(lib.capture).toHaveBeenCalledWith("gh pr create -f -B dev")
    expect(lib.waitForMerge).toHaveBeenCalledOnce()
    // phase 2
    expect(lib.capture).toHaveBeenCalledWith("gh pr create -f -B main")
    expect(lib.autoMergeAndWait).toHaveBeenCalledOnce()
    // phase 3 is not chained (release.yml tags automatically)
    expect(c.some((cmd) => cmd.startsWith("git tag"))).toBe(false)
  })

  it("runs only the dev → main step for --phase 2", async () => {
    setArgv("1.0.0", "--phase", "2")
    await main()

    expect(vi.mocked(fs.writeFileSync)).not.toHaveBeenCalled()
    expect(commands()).not.toContain("git checkout -b chore/v1.0.0")
    expect(lib.capture).toHaveBeenCalledWith("gh pr create -f -B main")
    expect(lib.autoMergeAndWait).toHaveBeenCalledOnce()
    expect(lib.waitForMerge).not.toHaveBeenCalled()
  })

  it("runs only tagging for --phase 3", async () => {
    setArgv("1.0.0", "--phase", "3")
    await main()

    const c = commands()
    expect(c).toContain('git tag v1.0.0 -m "v1.0.0" -s')
    expect(lib.capture).toHaveBeenCalledWith('gh release create v1.0.0 --target main -t "v1.0.0"')
    expect(lib.waitForMerge).not.toHaveBeenCalled()
    expect(lib.autoMergeAndWait).not.toHaveBeenCalled()
    expect(vi.mocked(fs.writeFileSync)).not.toHaveBeenCalled()
  })

  it("exits when no version is given", async () => {
    setArgv()
    await expect(main()).rejects.toThrow("exit:1")
  })

  it("exits on an out-of-range phase", async () => {
    setArgv("1.0.0", "--phase", "9")
    await expect(main()).rejects.toThrow("exit:1")
  })
})
