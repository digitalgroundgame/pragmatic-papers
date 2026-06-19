import { describe, expect, it } from "vitest"

import {
  PR_STATE_JQ,
  VERSION_RE,
  autoMergeCommand,
  findVersion,
  parsePrRef,
  prStateCommand,
} from "../../scripts/release-lib"

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
