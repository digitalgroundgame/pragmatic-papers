import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as SnapshotComment from "../../scripts/snapshot-comment"

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }))
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  copyFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  mkdtempSync: vi.fn((prefix: string) => `${prefix}abc123`),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => Buffer.from("fake-png-bytes")),
}))
vi.mock("../../scripts/snapshot-comment", async (importOriginal) => {
  const actual = await importOriginal<typeof SnapshotComment>()
  return { ...actual, readStdin: vi.fn() }
})

const { main, fingerprintFiles, referencedShas } =
  await import("../../scripts/pr-screenshot-comment")
const { readStdin } = await import("../../scripts/snapshot-comment")

const mockExecFileSync = vi.mocked(execFileSync)
const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)
const mockReadStdin = vi.mocked(readStdin)

/** Fake a readdirSync({ withFileTypes: true }) result of directory entries. */
function dirents(...names: string[]) {
  return names.map((name) => ({ name, isDirectory: () => true })) as unknown as ReturnType<
    typeof readdirSync
  >
}

const BASE_ENV = {
  GH_TOKEN: "ghtoken",
  OWNER: "org",
  REPO: "repo",
  PR_NUMBER: "42",
  ASSET_DIR: "42/abc123",
}

/** Route execFileSync calls by command/args so each test only stubs what it needs. */
function mockExec(handlers: Record<string, string | Error>) {
  mockExecFileSync.mockImplementation((cmd, args) => {
    const key = `${cmd} ${(args as string[]).join(" ")}`
    for (const [pattern, result] of Object.entries(handlers)) {
      if (key.includes(pattern)) {
        if (result instanceof Error) throw result
        return result
      }
    }
    return ""
  })
}

describe("referencedShas", () => {
  const opts = { owner: "org", repo: "repo", branch: "pr-screenshots", prNumber: "42" }

  it("extracts sha dirs from raw.githubusercontent links for the PR", () => {
    const bodies = [
      "![a](https://raw.githubusercontent.com/org/repo/pr-screenshots/42/aaa/home.png)",
      "before https://raw.githubusercontent.com/org/repo/pr-screenshots/42/bbb/regressions/x.png after",
    ]
    expect(referencedShas(bodies, opts)).toEqual(new Set(["aaa", "bbb"]))
  })

  it("ignores links to other PRs, other branches, and unrelated text", () => {
    const bodies = [
      "https://raw.githubusercontent.com/org/repo/pr-screenshots/99/zzz/home.png",
      "https://raw.githubusercontent.com/org/repo/other-branch/42/yyy/home.png",
      "no links here",
    ]
    expect(referencedShas(bodies, opts)).toEqual(new Set())
  })
})

describe("main", () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    for (const [k, v] of Object.entries(BASE_ENV)) process.env[k] = v
    delete process.env.ASSETS_BRANCH
    delete process.env.MARKER
    delete process.env.DELETE_WHEN_EMPTY
    delete process.env.TITLE
    delete process.env.COLUMNS_PER_ROW
    delete process.env.FOOTER
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(dirents())
  })

  afterEach(() => {
    warn.mockRestore()
    vi.clearAllMocks()
    for (const k of Object.keys(BASE_ENV)) delete process.env[k]
  })

  it("throws when required env vars are missing", async () => {
    delete process.env.GH_TOKEN
    await expect(main()).rejects.toThrow(/GH_TOKEN/)
  })

  it("does nothing when there are no files and no stale comment", async () => {
    mockReadStdin.mockResolvedValue("")
    mockExec({ "issues/42/comments": "[]" })

    await main()

    expect(warn).toHaveBeenCalledWith("No files and no stale comment — nothing to do.")
    expect(mockExecFileSync).not.toHaveBeenCalledWith("git", expect.anything(), expect.anything())
  })

  it("deletes the stale comment when files are empty and DELETE_WHEN_EMPTY is set", async () => {
    process.env.DELETE_WHEN_EMPTY = "true"
    mockReadStdin.mockResolvedValue("")
    mockExec({
      "issues/42/comments": JSON.stringify([{ id: 7, body: "<!-- screenshots:abc -->\nold" }]),
    })

    await main()

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["--method", "DELETE", "repos/org/repo/issues/comments/7"]),
      expect.anything(),
    )
    expect(warn).toHaveBeenCalledWith("Removed stale 'screenshots' comment.")
  })

  it("skips the upload when the fingerprint matches the existing comment", async () => {
    mockReadStdin.mockResolvedValue("a.png\n")
    const fingerprint = fingerprintFiles(["a.png"], readFileSync)
    mockExec({
      "issues/42/comments": JSON.stringify([
        { id: 7, body: `<!-- screenshots:${fingerprint} -->\nold` },
      ]),
    })

    await main()

    expect(warn).toHaveBeenCalledWith("Screenshots unchanged — skipping upload.")
    expect(mockExecFileSync).not.toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["clone"]),
      expect.anything(),
    )
  })

  it("clones as a new orphan branch, commits, and posts a fresh comment when none exists", async () => {
    mockReadStdin.mockResolvedValue("a.png\nb.png\n")
    mockExec({
      "issues/42/comments": "[]",
      "ls-remote": new Error("no such branch"),
    })

    await main()

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["clone", "--depth=1"]),
      expect.anything(),
    )
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["checkout", "--orphan", "pr-screenshots"],
      expect.anything(),
    )
    expect(mkdirSync).toHaveBeenCalled()
    expect(copyFileSync).toHaveBeenCalledTimes(2)
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["pr", "comment", "42"]),
      expect.anything(),
    )
    expect(warn).toHaveBeenCalledWith("'screenshots' comment posted on PR #42.")
  })

  it("clones the existing assets branch and PATCHes the existing comment", async () => {
    mockReadStdin.mockResolvedValue("a.png\n")
    mockExec({
      "issues/42/comments": JSON.stringify([{ id: 9, body: "<!-- screenshots: -->\nold" }]),
      "ls-remote": "abc123\trefs/heads/pr-screenshots\n",
    })

    await main()

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["clone", "--depth=1", "--branch", "pr-screenshots"]),
      expect.anything(),
    )
    expect(mockExecFileSync).not.toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["checkout", "--orphan"]),
      expect.anything(),
    )
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["--method", "PATCH", "repos/org/repo/issues/comments/9"]),
      expect.anything(),
    )
    expect(warn).toHaveBeenCalledWith("'screenshots' comment updated on PR #42.")
  })

  it("filters out stdin lines whose files don't exist on disk", async () => {
    mockReadStdin.mockResolvedValue("a.png\nmissing.png\n")
    mockExistsSync.mockImplementation((p) => p !== "missing.png")
    mockExec({
      "issues/42/comments": "[]",
      "ls-remote": "abc123\trefs/heads/pr-screenshots\n",
    })

    await main()

    expect(copyFileSync).toHaveBeenCalledTimes(1)
    expect(copyFileSync).toHaveBeenCalledWith("a.png", expect.stringContaining("a.png"))
  })

  it("prunes the PR's other sha dirs that no live comment references", async () => {
    mockReadStdin.mockResolvedValue("a.png\n")
    // The comment being updated points at the current sha; a stale dir and an
    // unrelated older sha both remain in the PR folder.
    mockReaddirSync.mockReturnValue(dirents("abc123", "staledir", "oldsha"))
    mockExec({
      "issues/42/comments": JSON.stringify([{ id: 9, body: "<!-- screenshots: -->\nold" }]),
      "ls-remote": "abc123\trefs/heads/pr-screenshots\n",
    })

    await main()

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["rm", "-r", "--quiet", "42/staledir"],
      expect.anything(),
    )
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["rm", "-r", "--quiet", "42/oldsha"],
      expect.anything(),
    )
    // The current upload's dir is never removed.
    expect(mockExecFileSync).not.toHaveBeenCalledWith(
      "git",
      ["rm", "-r", "--quiet", "42/abc123"],
      expect.anything(),
    )
  })

  it("keeps sha dirs another live comment still links to", async () => {
    mockReadStdin.mockResolvedValue("a.png\n")
    mockReaddirSync.mockReturnValue(dirents("abc123", "regsha"))
    // A different marker's comment (not the one we're updating) links to regsha.
    mockExec({
      "issues/42/comments": JSON.stringify([
        { id: 9, body: "<!-- screenshots: -->\nold" },
        {
          id: 10,
          body:
            "<!-- visual-regressions: -->\n" +
            "![x](https://raw.githubusercontent.com/org/repo/pr-screenshots/42/regsha/regressions/x.png)",
        },
      ]),
      "ls-remote": "abc123\trefs/heads/pr-screenshots\n",
    })

    await main()

    expect(mockExecFileSync).not.toHaveBeenCalledWith(
      "git",
      ["rm", "-r", "--quiet", "42/regsha"],
      expect.anything(),
    )
  })
})
