import { execSync } from "node:child_process"
import * as readline from "node:readline"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PR_STATE_JQ,
  VERSION_RE,
  ask,
  branchExists,
  bumpMessage,
  capture,
  commitIfStaged,
  commitSubjects,
  createOrReusePr,
  findVersion,
  hasStagedChanges,
  parsePrRef,
  prListCommand,
  prState,
  prStateCommand,
  prepareBranch,
  requireGh,
  run,
  waitForMerge,
  waitForSyncMerge,
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

  it("bumpMessage matches the commit subject the release makes", () => {
    expect(bumpMessage("v1.2.3")).toBe("Bump package.json to v1.2.3")
  })

  it("prListCommand looks up only the open PR for that head → base pair", () => {
    const cmd = prListCommand("chore/v1.2.3", "dev")
    expect(cmd).toContain("--head chore/v1.2.3")
    expect(cmd).toContain("--base dev")
    expect(cmd).toContain("--state open")
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

  it("waitForSyncMerge never issues a merge command — the operator merges by hand", async () => {
    stubPrompt("")
    vi.mocked(execSync).mockReturnValue("MERGED\n" as never)
    await waitForSyncMerge(PR)

    const commands = vi.mocked(execSync).mock.calls.map((c) => c[0] as string)
    expect(commands.some((cmd) => cmd.includes("gh pr merge"))).toBe(false)
    expect(readline.createInterface).toHaveBeenCalled()
  })

  it("waitForSyncMerge warns against squashing, which would diverge dev from main", async () => {
    stubPrompt("")
    vi.mocked(execSync).mockReturnValue("MERGED\n" as never)
    const warn = vi.spyOn(console, "warn")
    await waitForSyncMerge(PR)

    const output = warn.mock.calls.flat().join(" ")
    expect(output).toContain("merge commit")
    expect(output).toContain("not a squash")
  })

  it("waitForSyncMerge keeps prompting until the PR actually reports MERGED", async () => {
    stubPrompt("")
    vi.mocked(execSync)
      .mockReturnValueOnce("OPEN\n" as never)
      .mockReturnValueOnce("MERGED\n" as never)
    await waitForSyncMerge(PR)
    expect(vi.mocked(readline.createInterface)).toHaveBeenCalledTimes(2)
  })

  it("branchExists reports on the local ref, not a remote one", () => {
    vi.mocked(execSync).mockReturnValue("" as never)
    expect(branchExists("chore/v1.2.3")).toBe(true)
    expect(execSync).toHaveBeenCalledWith(
      "git rev-parse --verify --quiet refs/heads/chore/v1.2.3",
      expect.objectContaining({ stdio: "ignore" }),
    )

    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not a ref")
    })
    expect(branchExists("chore/v1.2.3")).toBe(false)
  })

  it("commitSubjects lists the branch's commits and drops the trailing blank", () => {
    vi.mocked(execSync).mockReturnValue("Bump package.json to v1.2.3\n" as never)
    expect(commitSubjects("dev", "chore/v1.2.3")).toEqual(["Bump package.json to v1.2.3"])

    vi.mocked(execSync).mockReturnValue("" as never)
    expect(commitSubjects("dev", "chore/v1.2.3")).toEqual([])
  })

  it("hasStagedChanges inverts the exit code of git diff --cached --quiet", () => {
    vi.mocked(execSync).mockReturnValue("" as never)
    expect(hasStagedChanges()).toBe(false)

    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("exit 1")
    })
    expect(hasStagedChanges()).toBe(true)
  })

  it("commitIfStaged commits staged work", () => {
    // `git diff --cached --quiet` exits non-zero when something is staged.
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      if (cmd.startsWith("git diff")) throw new Error("exit 1")
      return ""
    }) as never)

    commitIfStaged("Bump package.json to v1.2.3")
    expect(execSync).toHaveBeenCalledWith(
      'git commit -m "Bump package.json to v1.2.3"',
      expect.objectContaining({ stdio: "inherit" }),
    )
  })

  it("commitIfStaged skips the commit when a retry already made it", () => {
    vi.mocked(execSync).mockReturnValue("" as never) // nothing staged
    commitIfStaged("Bump package.json to v1.2.3")
    expect(execSync).toHaveBeenCalledOnce() // only the staged check, no commit
  })

  it("createOrReusePr reuses an open PR instead of creating a second one", () => {
    vi.mocked(execSync).mockReturnValue("https://github.com/o/r/pull/9\n" as never)
    expect(createOrReusePr("chore/v1.2.3", "dev")).toBe("https://github.com/o/r/pull/9")
    expect(execSync).toHaveBeenCalledOnce()
    expect(execSync).toHaveBeenCalledWith(prListCommand("chore/v1.2.3", "dev"), expect.any(Object))
  })

  it("createOrReusePr creates a PR when none is open", () => {
    vi.mocked(execSync)
      .mockReturnValueOnce("" as never) // no existing PR
      .mockReturnValueOnce("https://github.com/o/r/pull/10\n" as never)
    expect(createOrReusePr("chore/v1.2.3", "dev")).toBe("https://github.com/o/r/pull/10")
    expect(execSync).toHaveBeenNthCalledWith(2, "gh pr create -f -B dev", expect.any(Object))
  })

  it("createOrReusePr sets an explicit title, since --fill would use the branch name", () => {
    vi.mocked(execSync)
      .mockReturnValueOnce("" as never) // no existing PR
      .mockReturnValueOnce("https://github.com/o/r/pull/11\n" as never)
    createOrReusePr("dev", "main", "Release 1.2.3")
    expect(execSync).toHaveBeenNthCalledWith(
      2,
      'gh pr create -f -t "Release 1.2.3" -B main',
      expect.any(Object),
    )
  })
})

// ── prepareBranch: resuming a half-finished run ────────────────────────────

describe("prepareBranch", () => {
  const BRANCH = "chore/v1.2.3"

  /** Route each git command to a canned result; `exists` toggles the ref lookup. */
  function stubGit({ exists, subjects = "" }: { exists: boolean; subjects?: string }) {
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      if (cmd.startsWith("git rev-parse")) {
        if (!exists) throw new Error("not a ref")
        return ""
      }
      if (cmd.startsWith("git log")) return subjects
      return ""
    }) as never)
  }

  const gitCalls = () => vi.mocked(execSync).mock.calls.map((c) => c[0] as string)

  beforeEach(() => {
    vi.mocked(execSync).mockReset()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates the branch when it does not exist yet", () => {
    stubGit({ exists: false })
    prepareBranch(BRANCH, "dev", "v1.2.3")
    expect(gitCalls()).toContain(`git checkout -b ${BRANCH}`)
  })

  it("reuses an empty branch left behind by a failed run", () => {
    stubGit({ exists: true, subjects: "" })
    prepareBranch(BRANCH, "dev", "v1.2.3")

    const calls = gitCalls()
    expect(calls).toContain(`git checkout ${BRANCH}`)
    expect(calls).not.toContain(`git checkout -b ${BRANCH}`)
  })

  it("reuses a branch that already carries the bump commit", () => {
    stubGit({ exists: true, subjects: "Bump package.json to v1.2.3\n" })
    prepareBranch(BRANCH, "dev", "v1.2.3")
    expect(gitCalls()).toContain(`git checkout ${BRANCH}`)
  })

  it("refuses to touch a branch carrying unrelated commits", () => {
    stubGit({ exists: true, subjects: "feat: something else\n" })
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as never)

    expect(() => prepareBranch(BRANCH, "dev", "v1.2.3")).toThrow("exit:1")
    expect(gitCalls()).not.toContain(`git checkout ${BRANCH}`)
    exit.mockRestore()
  })
})
