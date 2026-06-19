import { execSync } from "node:child_process"
import * as readline from "node:readline"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PR_STATE_JQ,
  VERSION_RE,
  ask,
  autoMergeAndWait,
  autoMergeCommand,
  capture,
  findVersion,
  parsePrRef,
  prState,
  prStateCommand,
  requireGh,
  run,
  waitForMerge,
} from "../../scripts/release-lib"

vi.mock("node:child_process", () => ({ execSync: vi.fn() }))
vi.mock("node:readline", () => ({ createInterface: vi.fn() }))

const PR = "https://github.com/o/r/pull/7"

// Make readline.createInterface return an interface whose `question` immediately
// answers, so `ask`/`waitForMerge` resolve without real stdin.
function stubPrompt(answer = "") {
  vi.mocked(readline.createInterface).mockReturnValue({
    question: (_q: string, cb: (a: string) => void) => cb(answer),
    close: vi.fn(),
  } as unknown as readline.Interface)
}

// ── Pure helpers ───────────────────────────────────────────────────────────

describe("VERSION_RE / findVersion", () => {
  it("accepts bare semver", () => {
    expect(VERSION_RE.test("1.0.1")).toBe(true)
    expect(VERSION_RE.test("12.34.56")).toBe(true)
  })

  it("rejects non-semver, including a leading v or pre-release", () => {
    expect(VERSION_RE.test("v1.0.1")).toBe(false)
    expect(VERSION_RE.test("1.0")).toBe(false)
    expect(VERSION_RE.test("1.0.1-rc.1")).toBe(false)
    expect(VERSION_RE.test("nope")).toBe(false)
  })

  it("picks the first semver-looking positional", () => {
    expect(findVersion(["--phase", "2", "1.2.3"])).toBe("1.2.3")
    expect(findVersion(["v1.2.3", "nope"])).toBeUndefined()
    expect(findVersion([])).toBeUndefined()
  })
})

describe("parsePrRef", () => {
  it("extracts owner/repo/number from a PR URL", () => {
    expect(parsePrRef("https://github.com/digitalgroundgame/pragmatic-papers/pull/555")).toEqual({
      owner: "digitalgroundgame",
      repo: "pragmatic-papers",
      number: "555",
    })
  })

  it("throws on an unparseable URL", () => {
    expect(() => parsePrRef("https://example.com/not/a/pr")).toThrow(/Cannot parse PR URL/)
  })
})

describe("command builders", () => {
  const ref = { owner: "o", repo: "r", number: "7" }

  it("prStateCommand queries the PR and collapses state via jq", () => {
    expect(prStateCommand(ref)).toBe(`gh api repos/o/r/pulls/7 --jq '${PR_STATE_JQ}'`)
    expect(PR_STATE_JQ).toContain("MERGED")
  })

  it("autoMergeCommand forces a merge commit, never a squash", () => {
    const cmd = autoMergeCommand("https://github.com/o/r/pull/7")
    expect(cmd).toBe(`gh pr merge "https://github.com/o/r/pull/7" --auto --merge`)
    expect(cmd).not.toContain("--squash")
  })
})

// ── Side-effecting helpers ─────────────────────────────────────────────────

describe("side-effecting helpers", () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset()
    vi.mocked(readline.createInterface).mockReset()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("run executes the command in the repo root, inheriting stdio", () => {
    run("git status")
    expect(execSync).toHaveBeenCalledWith(
      "git status",
      expect.objectContaining({ stdio: "inherit" }),
    )
  })

  it("capture returns trimmed stdout", () => {
    vi.mocked(execSync).mockReturnValue("  hi \n" as never)
    expect(capture("echo hi")).toBe("hi")
  })

  it("requireGh passes when gh is installed", () => {
    vi.mocked(execSync).mockReturnValue("" as never)
    expect(() => requireGh()).not.toThrow()
    expect(execSync).toHaveBeenCalledWith("gh --version", { stdio: "ignore" })
  })

  it("requireGh exits when gh is missing", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found")
    })
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as never)
    expect(() => requireGh()).toThrow("exit:1")
    exit.mockRestore()
  })

  it("prState collapses the gh api output", () => {
    vi.mocked(execSync).mockReturnValue("MERGED\n" as never)
    expect(prState(PR)).toBe("MERGED")
    expect(execSync).toHaveBeenCalledWith(
      prStateCommand({ owner: "o", repo: "r", number: "7" }),
      expect.any(Object),
    )
  })

  it("ask resolves with the typed answer", async () => {
    stubPrompt("yes")
    await expect(ask("continue? ")).resolves.toBe("yes")
  })

  it("waitForMerge loops until the PR reports MERGED", async () => {
    stubPrompt("")
    vi.mocked(execSync)
      .mockReturnValueOnce("OPEN\n" as never)
      .mockReturnValueOnce("MERGED\n" as never)
    await waitForMerge(PR)
    expect(execSync).toHaveBeenCalledTimes(2)
  })

  it("autoMergeAndWait enables auto-merge then polls to MERGED", async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce("" as never) // run(autoMergeCommand)
      .mockReturnValueOnce("OPEN\n" as never) // poll 1
      .mockReturnValueOnce("MERGED\n" as never) // poll 2
    await autoMergeAndWait(PR, 1)
    expect(execSync).toHaveBeenNthCalledWith(1, autoMergeCommand(PR), expect.any(Object))
    expect(execSync).toHaveBeenCalledTimes(3)
  })

  it("autoMergeAndWait exits if the PR is closed without merging", async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce("" as never) // run(autoMergeCommand)
      .mockReturnValueOnce("CLOSED\n" as never) // poll
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as never)
    await expect(autoMergeAndWait(PR, 1)).rejects.toThrow("exit:1")
    exit.mockRestore()
  })

  it("autoMergeAndWait falls back to a manual prompt when auto-merge can't be enabled", async () => {
    stubPrompt("")
    vi.mocked(execSync)
      .mockImplementationOnce(() => {
        throw new Error("auto-merge not allowed")
      }) // run(autoMergeCommand) fails
      .mockReturnValueOnce("MERGED\n" as never) // waitForMerge → prState
    await autoMergeAndWait(PR, 1)
    expect(readline.createInterface).toHaveBeenCalled()
  })
})
