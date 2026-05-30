import { describe, expect, it } from "vitest"

import {
  computeFileMetrics,
  computePatchCoverage,
  deltaIcon,
  indexCoverageByFile,
  parseAddedLines,
} from "../../scripts/coverage-report"

// A synthetic istanbul file-coverage object:
//  line 1 — statement ran (1)         → covered
//  line 2 — statement never ran (0) + a function declared here, never called (0)
//  line 3 — statement ran (5) + an if-branch with one arm taken, one not ([1, 0])
const fileCoverage = {
  path: "/repo/src/a.ts",
  statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 2 } }, 2: { start: { line: 3 } } },
  s: { 0: 1, 1: 0, 2: 5 },
  fnMap: { 0: { line: 2, decl: { start: { line: 2 } } } },
  f: { 0: 0 },
  branchMap: { 0: { line: 3, loc: { start: { line: 3 } } } },
  b: { 0: [1, 0] },
}

describe("parseAddedLines", () => {
  it("collects added line numbers on the new side of a hunk", () => {
    const patch = ["@@ -1,2 +1,3 @@", " context", "+added one", "+added two", " trailing"].join(
      "\n",
    )
    expect([...parseAddedLines(patch)].sort((a, b) => a - b)).toEqual([2, 3])
  })

  it("does not advance the new-side counter for removed lines", () => {
    const patch = ["@@ -1,3 +1,2 @@", " keep", "-removed", "+replacement"].join("\n")
    expect([...parseAddedLines(patch)]).toEqual([2])
  })

  it("handles multiple hunks", () => {
    const patch = ["@@ -1,1 +1,1 @@", "+first", "@@ -10,1 +20,1 @@", "+second"].join("\n")
    expect([...parseAddedLines(patch)].sort((a, b) => a - b)).toEqual([1, 20])
  })

  it("returns an empty set for an empty patch", () => {
    expect(parseAddedLines("").size).toBe(0)
  })
})

describe("indexCoverageByFile", () => {
  it("re-keys absolute coverage paths to repo-relative paths", () => {
    const indexed = indexCoverageByFile({ x: fileCoverage }, "/repo")
    expect(Object.keys(indexed)).toEqual(["src/a.ts"])
  })
})

describe("computeFileMetrics", () => {
  it("measures each metric against only the changed lines", () => {
    // line 4 is not coverable (no statement) → excluded everywhere
    const { counts, uncoveredLines } = computeFileMetrics(fileCoverage, new Set([1, 2, 3, 4]))
    expect(counts.lines).toEqual({ covered: 2, total: 3 })
    expect(counts.statements).toEqual({ covered: 2, total: 3 })
    expect(counts.functions).toEqual({ covered: 0, total: 1 })
    expect(counts.branches).toEqual({ covered: 1, total: 2 }) // one arm of two taken
    expect(uncoveredLines).toEqual([2])
  })

  it("ignores changed lines outside the file's coverage map", () => {
    const { counts } = computeFileMetrics(fileCoverage, new Set([99]))
    for (const m of Object.values(counts)) expect(m.total).toBe(0)
  })
})

describe("deltaIcon", () => {
  it("returns 🟢 when coverage improved", () => {
    expect(deltaIcon(0.5)).toBe("🟢")
    expect(deltaIcon(0.002)).toBe("🟢") // just above threshold
  })

  it("returns 🔴 when coverage worsened", () => {
    expect(deltaIcon(-0.5)).toBe("🔴")
    expect(deltaIcon(-0.002)).toBe("🔴") // just below threshold
  })

  it("returns 🟡 when coverage is unchanged within floating-point noise", () => {
    expect(deltaIcon(0)).toBe("🟡")
    expect(deltaIcon(0.001)).toBe("🟡") // at threshold, not beyond
    expect(deltaIcon(-0.001)).toBe("🟡") // at threshold, not beyond
  })
})

describe("computePatchCoverage", () => {
  it("aggregates metrics and computes percentages", () => {
    const result = computePatchCoverage(
      { "src/a.ts": fileCoverage },
      { "src/a.ts": new Set([1, 2, 3]) },
    )
    expect(result.metrics.lines.pct).toBeCloseTo(66.67, 1)
    expect(result.metrics.branches.pct).toBe(50)
    expect(result.files).toEqual([{ file: "src/a.ts", uncovered: [2] }])
  })

  it("ignores files that were not instrumented and reports 100%", () => {
    const result = computePatchCoverage(
      { "src/a.ts": fileCoverage },
      { "src/untracked.ts": new Set([1, 2]) },
    )
    expect(result.metrics.lines.total).toBe(0)
    expect(result.metrics.lines.pct).toBe(100)
    expect(result.files).toEqual([])
  })
})
