import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ReleaseLib from "../../scripts/release-lib"

const lib = vi.hoisted(() => ({
  run: vi.fn(),
  capture: vi.fn(() => "https://github.com/o/r/pull/1"),
  requireGh: vi.fn(),
  waitForMerge: vi.fn(),
  autoMergeAndWait: vi.fn(),
  prepareBranch: vi.fn(),
  commitIfStaged: vi.fn(),
  createOrReusePr: vi.fn(() => "https://github.com/o/r/pull/1"),
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
const { main, hotfixBranch, backmergeBranch } = await import("../../scripts/hotfix")
const { releaseBranch } = await import("../../scripts/release")

describe("branch builders", () => {
  it("hotfixBranch carries the fix onto main under hotfix/v*", () => {
    expect(hotfixBranch("1.0.1")).toBe("hotfix/v1.0.1")
  })

  it("backmergeBranch back-merges main → dev under chore/back-merge-v*", () => {
    expect(backmergeBranch("1.0.1")).toBe("chore/back-merge-v1.0.1")
  })

  it("releaseBranch carries the bump into dev under chore/v*", () => {
    expect(releaseBranch("2.2.0")).toBe("chore/v2.2.0")
  })
})

const realArgv = process.argv
const commands = () => lib.run.mock.calls.map((c) => c[0] as string)
const setArgv = (...args: string[]) => (process.argv = ["node", "hotfix.ts", ...args])

describe("hotfix main()", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lib.capture.mockReturnValue("https://github.com/o/r/pull/1")
    lib.createOrReusePr.mockReturnValue("https://github.com/o/r/pull/1")
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

  it("chains phase 1 (PR → main) into phase 2 (back-merge → dev) by default", async () => {
    setArgv("1.0.1")
    await main()

    expect(lib.requireGh).toHaveBeenCalledOnce()

    const c = commands()
    // phase 1
    expect(lib.prepareBranch).toHaveBeenCalledWith("hotfix/v1.0.1", "main", "v1.0.1")
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce()
    const [, written] = vi.mocked(fs.writeFileSync).mock.calls[0] ?? []
    expect(String(written)).toContain('"version": "1.0.1"')
    expect(c).toContain("git add package.json")
    expect(lib.commitIfStaged).toHaveBeenCalledWith("Bump package.json to v1.0.1")
    expect(lib.createOrReusePr).toHaveBeenCalledWith("hotfix/v1.0.1", "main")
    expect(lib.waitForMerge).toHaveBeenCalledOnce()
    // phase 2
    expect(lib.prepareBranch).toHaveBeenCalledWith("chore/back-merge-v1.0.1", "main", "v1.0.1")
    expect(lib.createOrReusePr).toHaveBeenCalledWith("chore/back-merge-v1.0.1", "dev")
    expect(lib.autoMergeAndWait).toHaveBeenCalledOnce()
  })

  it("runs only the back-merge for --phase 2", async () => {
    setArgv("1.0.1", "--phase", "2")
    await main()

    expect(vi.mocked(fs.writeFileSync)).not.toHaveBeenCalled()
    expect(lib.prepareBranch).toHaveBeenCalledExactlyOnceWith(
      "chore/back-merge-v1.0.1",
      "main",
      "v1.0.1",
    )
    expect(lib.createOrReusePr).toHaveBeenCalledExactlyOnceWith("chore/back-merge-v1.0.1", "dev")
    expect(lib.autoMergeAndWait).toHaveBeenCalledOnce()
    expect(lib.waitForMerge).not.toHaveBeenCalled()
  })

  it("exits when no version is given", async () => {
    setArgv()
    await expect(main()).rejects.toThrow("exit:1")
  })

  it("exits on an out-of-range phase", async () => {
    setArgv("1.0.1", "--phase", "9")
    await expect(main()).rejects.toThrow("exit:1")
  })
})
