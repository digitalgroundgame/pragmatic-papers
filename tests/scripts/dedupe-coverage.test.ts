import { describe, expect, it } from "vitest"

import { dedupeFile, summarize, summarizeFile } from "../../scripts/dedupe-coverage"

const range = (line: number, column: number, endColumn: number | null = column + 5) => ({
  start: { line, column },
  end: { line, column: endColumn },
})

const fn = (name: string, line: number, endColumn: number | null) => ({
  name,
  decl: range(line, 9, endColumn),
  loc: range(line, 0, 1),
  line,
})

const branch = (line: number, arms: number) => ({
  type: "if",
  loc: range(line, 2),
  locations: Array.from({ length: arms }, () => range(line, 2)),
  line,
})

// One function instrumented by both the unit and the story run: the second copy's end
// column didn't map, so the merge kept it as a separate entry.
const merged = {
  path: "/repo/src/thing.ts",
  statementMap: { 0: range(1, 0), 1: range(2, 2), 2: range(2, 2, null), 3: range(3, 2) },
  s: { 0: 1, 1: 0, 2: 4, 3: 0 },
  fnMap: { 0: fn("render", 1, 15), 1: fn("render_2", 1, null), 2: fn("other", 5, 14) },
  f: { 0: 0, 1: 3, 2: 0 },
  branchMap: { 0: branch(2, 2), 1: branch(2, 2), 2: branch(2, 3) },
  b: { 0: [1, 0], 1: [0, 2], 2: [0, 0, 0] },
}

describe("dedupeFile", () => {
  const deduped = dedupeFile(merged)

  it("keeps one entry per start position and adds up the hits", () => {
    expect(deduped.s).toEqual({ 0: 1, 1: 4, 2: 0 })
    expect(Object.values(deduped.fnMap).map((f) => f.name)).toEqual(["render", "other"])
    expect(deduped.f).toEqual({ 0: 3, 1: 0 })
  })

  it("only combines branches with the same arms", () => {
    expect(deduped.b).toEqual({ 0: [1, 2], 1: [0, 0, 0] })
  })

  it("leaves everything else on the file alone", () => {
    expect(deduped.path).toBe(merged.path)
  })
})

describe("summarizeFile", () => {
  it("counts lines by the statements that start on them, as istanbul does", () => {
    expect(summarizeFile(dedupeFile(merged))).toEqual({
      lines: { total: 3, covered: 2, skipped: 0, pct: 66.66 },
      statements: { total: 3, covered: 2, skipped: 0, pct: 66.66 },
      functions: { total: 2, covered: 1, skipped: 0, pct: 50 },
      branches: { total: 5, covered: 2, skipped: 0, pct: 40 },
    })
  })

  it("reports a file with nothing to cover as 100%", () => {
    const empty = {
      path: "/repo/src/types.ts",
      statementMap: {},
      s: {},
      fnMap: {},
      f: {},
      branchMap: {},
      b: {},
    }
    expect(summarizeFile(empty).lines).toEqual({ total: 0, covered: 0, skipped: 0, pct: 100 })
  })
})

describe("summarize", () => {
  it("adds every file into the total", () => {
    const file = dedupeFile(merged)
    const summary = summarize({ "/repo/a.ts": file, "/repo/b.ts": file })
    expect(Object.keys(summary)).toEqual(["total", "/repo/a.ts", "/repo/b.ts"])
    expect(summary.total!.functions).toEqual({ total: 4, covered: 2, skipped: 0, pct: 50 })
  })
})
