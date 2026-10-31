import { describe, expect, it } from "vitest"

import {
  type FileCoverage,
  mergeCoverage,
  mergeFile,
  summarize,
  summarizeFile,
} from "../../scripts/merge-coverage"

const range = (line: number, column: number, endColumn: number | null = column + 5) => ({
  start: { line, column },
  end: { line, column: endColumn },
})

const fn = (name: string, line: number, column: number) => ({
  name,
  decl: range(line, column),
  loc: range(line, 0),
  line,
})

const branch = (line: number, arms: number, type = "if") => ({
  type,
  loc: range(line, 2),
  locations: Array.from({ length: arms }, () => range(line, 2)),
  line,
})

// What the unit run (Node) recorded for a file.
const unit: FileCoverage = {
  path: "/repo/src/thing.tsx",
  statementMap: { 0: range(1, 0), 1: range(2, 2), 2: range(2, 20), 3: range(3, 2) },
  s: { 0: 1, 1: 0, 2: 0, 3: 0 },
  fnMap: { 0: fn("render", 1, 9), 1: fn("onClick", 5, 4) },
  f: { 0: 1, 1: 0 },
  branchMap: { 0: branch(2, 2), 1: branch(4, 2) },
  b: { 0: [1, 0], 1: [0, 0] },
}

// The same file from the story run (Chromium): its columns are shifted, its ends don't
// always map, and it has a statement the unit map doesn't.
const stories: FileCoverage = {
  path: "/repo/src/thing.tsx",
  statementMap: {
    0: range(1, 0),
    1: range(2, 0, null),
    2: range(2, 18),
    3: range(9, 0),
  },
  s: { 0: 1, 1: 0, 2: 3, 3: 7 },
  fnMap: { 0: fn("render", 1, 7), 1: fn("onClick", 5, 2) },
  f: { 0: 2, 1: 4 },
  branchMap: { 0: branch(2, 2), 1: branch(4, 3) },
  b: { 0: [0, 5], 1: [1, 1, 1] },
}

describe("mergeFile", () => {
  const merged = mergeFile(unit, stories)

  it("keeps the unit map and adds the stories' hits by line and order", () => {
    expect(merged.statementMap).toBe(unit.statementMap)
    expect(merged.s).toEqual({ 0: 2, 1: 0, 2: 3, 3: 0 })
    expect(merged.f).toEqual({ 0: 3, 1: 4 })
  })

  it("only adds a branch's arms when both have the same number", () => {
    expect(merged.b).toEqual({ 0: [1, 5], 1: [0, 0] })
  })

  it("leaves the unit coverage it started from alone", () => {
    expect(unit.s[2]).toBe(0)
    expect(unit.b[0]).toEqual([1, 0])
  })
})

describe("mergeCoverage", () => {
  it("drops files only the stories saw", () => {
    const merged = mergeCoverage(
      { [unit.path]: unit },
      { [unit.path]: stories, "/repo/scripts/other.ts": stories },
    )
    expect(Object.keys(merged)).toEqual([unit.path])
  })
})

describe("summarizeFile", () => {
  it("counts lines by the statements that start on them, as istanbul does", () => {
    expect(summarizeFile(mergeFile(unit, stories))).toEqual({
      lines: { total: 3, covered: 2, skipped: 0, pct: 66.66 },
      statements: { total: 4, covered: 2, skipped: 0, pct: 50 },
      functions: { total: 2, covered: 2, skipped: 0, pct: 100 },
      branches: { total: 4, covered: 2, skipped: 0, pct: 50 },
    })
  })

  it("reports a file with nothing to cover as 100%", () => {
    const empty = { ...unit, statementMap: {}, s: {}, fnMap: {}, f: {}, branchMap: {}, b: {} }
    expect(summarizeFile(empty).lines).toEqual({ total: 0, covered: 0, skipped: 0, pct: 100 })
  })
})

describe("summarize", () => {
  it("adds every file into the total", () => {
    const summary = summarize({ "/repo/a.ts": unit, "/repo/b.ts": unit })
    expect(Object.keys(summary)).toEqual(["total", "/repo/a.ts", "/repo/b.ts"])
    expect(summary.total!.functions).toEqual({ total: 4, covered: 2, skipped: 0, pct: 50 })
  })
})
