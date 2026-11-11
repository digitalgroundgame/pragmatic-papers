import { describe, expect, it, vi } from "vitest"

import {
  type FileChange,
  LARGE_LINES,
  main,
  parseNumstat,
  pickEffort,
  SMALL_LINES,
} from "../../scripts/review-effort"

const change = (path: string, lines: number): FileChange => ({ path, lines })

describe("parseNumstat", () => {
  it("adds added and removed lines per file", () => {
    expect(parseNumstat("3\t2\tsrc/a.ts\n10\t0\tsrc/b.tsx\n")).toEqual([
      change("src/a.ts", 5),
      change("src/b.tsx", 10),
    ])
  })

  it("counts binary files as 0 lines", () => {
    expect(parseNumstat("-\t-\tpublic/logo.png")).toEqual([change("public/logo.png", 0)])
  })

  it("reads the new path of a rename", () => {
    expect(parseNumstat("1\t1\tsrc/{old => new}/x.ts\n0\t0\ta.ts => b.ts")).toEqual([
      change("src/new/x.ts", 2),
      change("b.ts", 0),
    ])
  })

  it("reads a rename out of a folder", () => {
    expect(parseNumstat("1\t0\tsrc/{lib => }/x.ts")).toEqual([change("src/x.ts", 1)])
  })
})

describe("pickEffort", () => {
  it.each([
    [1, "medium"],
    [SMALL_LINES, "medium"],
    [SMALL_LINES + 1, "high"],
    [LARGE_LINES, "high"],
    [LARGE_LINES + 1, "xhigh"],
  ])("reviews %i changed lines at %s", (lines, effort) => {
    expect(pickEffort([change("src/components/Card.tsx", lines)])).toBe(effort)
  })

  it("adds lines across files", () => {
    expect(pickEffort([change("src/a.ts", 30), change("src/b.ts", 30)])).toBe("high")
  })

  it("leaves generated files out of the size", () => {
    expect(
      pickEffort([
        change("src/a.ts", 10),
        change("pnpm-lock.yaml", 5000),
        change("src/payload-types.ts", 800),
        change("src/app/(payload)/admin/importMap.js", 40),
        change("src/components/ui/__tests__/__snapshots__/button.snapshot.test.tsx.snap", 200),
      ]),
    ).toBe("medium")
  })

  it("leaves a migration's snapshot out of the size, though the migration raises the level", () => {
    expect(
      pickEffort([
        change("src/migrations/20261110_x.ts", 20),
        change("src/migrations/20261110_x.json", 9000),
      ]),
    ).toBe("high")
  })

  it.each([
    ".github/workflows/ci.yml",
    "src/migrations/20261110_x.ts",
    "src/access/roles.ts",
    "src/plugins/sso/strategy.ts",
    "src/plugins/comments/checks.ts",
    "src/payload.config.ts",
    "next.config.ts",
  ])("goes up a level for %s", (path) => {
    expect(pickEffort([change(path, 1)])).toBe("high")
    expect(pickEffort([change(path, SMALL_LINES + 1)])).toBe("xhigh")
  })

  it("stops at xhigh", () => {
    expect(pickEffort([change(".github/workflows/ci.yml", LARGE_LINES + 1)])).toBe("xhigh")
  })

  it("reviews an empty diff at medium", () => {
    expect(pickEffort([])).toBe("medium")
  })
})

describe("main", () => {
  const deps = (numstat: string) => ({
    numstat: vi.fn(() => numstat),
    output: vi.fn(),
    log: vi.fn(),
  })

  it("diffs base to head and sets the effort output", () => {
    const d = deps("100\t0\tsrc/a.ts")
    expect(main(["base", "head"], d)).toBe(0)
    expect(d.numstat).toHaveBeenCalledWith("base", "head")
    expect(d.output).toHaveBeenCalledWith("effort", "high")
  })

  it("fails without both commits", () => {
    const d = deps("")
    expect(main(["base"], d)).toBe(1)
    expect(d.output).not.toHaveBeenCalled()
  })
})
