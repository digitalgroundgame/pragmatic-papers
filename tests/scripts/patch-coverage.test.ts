import { describe, expect, it } from "vitest"

import { computePatchCoverage, parseAddedLines, parseLcov } from "../../scripts/patch-coverage.mjs"

describe("parseLcov", () => {
  it("maps each file to its line → hits", () => {
    const lcov = [
      "SF:src/a.ts",
      "DA:1,1",
      "DA:2,0",
      "end_of_record",
      "SF:src/b.ts",
      "DA:5,3",
      "end_of_record",
    ].join("\n")
    const result = parseLcov(lcov)
    expect(result["src/a.ts"]?.get(1)).toBe(1)
    expect(result["src/a.ts"]?.get(2)).toBe(0)
    expect(result["src/b.ts"]?.get(5)).toBe(3)
  })
})

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

describe("computePatchCoverage", () => {
  const lineHits = {
    "src/a.ts": new Map([
      [1, 1],
      [2, 0],
      [3, 5],
    ]),
  }

  it("counts only executable changed lines", () => {
    // line 4 is not in lineHits (blank/comment) → excluded from the denominator
    const added = { "src/a.ts": new Set([1, 2, 3, 4]) }
    const result = computePatchCoverage(lineHits, added)
    expect(result.covered).toBe(2)
    expect(result.total).toBe(3)
    expect(result.pct).toBeCloseTo(66.67, 1)
    expect(result.files[0]?.uncovered).toEqual([2])
  })

  it("ignores files that were not instrumented", () => {
    const added = { "src/untracked.ts": new Set([1, 2]) }
    const result = computePatchCoverage(lineHits, added)
    expect(result.total).toBe(0)
    expect(result.pct).toBe(100)
  })

  it("reports 100% when no executable lines changed", () => {
    const added = { "src/a.ts": new Set([99]) }
    expect(computePatchCoverage(lineHits, added).pct).toBe(100)
  })
})
