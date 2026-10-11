// Merges the story tests' coverage into the unit tests' for CI's coverage report.
//
// The two runs instrument the same files differently: the unit tests in Node, the stories
// in Chromium, each through its own transform. Their maps agree on which line a statement,
// function or branch starts on but not always on the column (type annotations strip to
// different widths) or the end, so istanbul's merge, which keys entries by their whole
// location, lists most of them twice. Instead the unit map is the authority: each of its
// entries takes the hits of the story entry that starts on the same line in the same order,
// and story entries with no counterpart are dropped. The totals are the unit run's, and the
// stories can only mark more of them covered.
//
// Usage: node scripts/merge-coverage.ts <out-dir> <unit coverage-final.json> <story coverage-final.json>...
// Writes coverage-final.json and coverage-summary.json to <out-dir>.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

interface Position {
  line: number
  column: number | null
}

interface Range {
  start: Position
  end: Position
}

export interface FileCoverage {
  path: string
  statementMap: Record<string, Range>
  s: Record<string, number>
  fnMap: Record<string, { name: string; decl: Range; loc: Range; line: number }>
  f: Record<string, number>
  branchMap: Record<string, { type: string; loc: Range; locations: Range[]; line: number }>
  b: Record<string, number[]>
  [key: string]: unknown
}

export type CoverageMap = Record<string, FileCoverage>

interface Metric {
  total: number
  covered: number
  skipped: number
  pct: number
}

interface FileSummary {
  lines: Metric
  statements: Metric
  functions: Metric
  branches: Metric
}

/** Keys each entry by its start line and its place among the entries starting there. */
function keyByLine<E>(map: Record<string, E>, lineOf: (entry: E) => number): Map<string, string> {
  const ids = Object.keys(map).sort((a, b) => Number(a) - Number(b))
  const seen = new Map<number, number>()
  const keys = new Map<string, string>()
  for (const id of ids) {
    const line = lineOf(map[id]!)
    const nth = seen.get(line) ?? 0
    seen.set(line, nth + 1)
    keys.set(`${line}#${nth}`, id)
  }
  return keys
}

/** Adds `extra`'s hits onto `base`'s matching entries, in place. */
function addHits<E, H>(
  base: { map: Record<string, E>; hits: Record<string, H> },
  extra: { map: Record<string, E>; hits: Record<string, H> },
  lineOf: (entry: E) => number,
  add: (a: H, b: H, baseEntry: E, extraEntry: E) => H,
): void {
  const extraKeys = keyByLine(extra.map, lineOf)
  for (const [key, id] of keyByLine(base.map, lineOf)) {
    const extraId = extraKeys.get(key)
    if (extraId === undefined) continue
    base.hits[id] = add(base.hits[id]!, extra.hits[extraId]!, base.map[id]!, extra.map[extraId]!)
  }
}

export function mergeFile(base: FileCoverage, extra: FileCoverage): FileCoverage {
  const merged: FileCoverage = {
    ...base,
    s: { ...base.s },
    f: { ...base.f },
    b: Object.fromEntries(Object.entries(base.b).map(([id, arms]) => [id, [...arms]])),
  }
  const sum = (a: number, b: number) => a + b
  addHits(
    { map: merged.statementMap, hits: merged.s },
    { map: extra.statementMap, hits: extra.s },
    (r) => r.start.line,
    sum,
  )
  addHits(
    { map: merged.fnMap, hits: merged.f },
    { map: extra.fnMap, hits: extra.f },
    (fn) => fn.decl.start.line,
    sum,
  )
  // A branch takes the other's arms only when it has the same number of them.
  addHits(
    { map: merged.branchMap, hits: merged.b },
    { map: extra.branchMap, hits: extra.b },
    (br) => br.loc.start.line,
    (a, b, baseBranch, extraBranch) =>
      baseBranch.type === extraBranch.type && a.length === b.length
        ? a.map((n, i) => n + b[i]!)
        : a,
  )
  return merged
}

export function mergeCoverage(base: CoverageMap, ...extras: CoverageMap[]): CoverageMap {
  const merged: CoverageMap = { ...base }
  for (const extra of extras) {
    for (const [path, fc] of Object.entries(extra)) {
      if (merged[path]) merged[path] = mergeFile(merged[path], fc)
    }
  }
  return merged
}

const metric = (covered: number, total: number): Metric => ({
  total,
  covered,
  skipped: 0,
  // istanbul's rounding, and 100% for a file with nothing to cover
  pct: total === 0 ? 100 : Math.floor((1e5 * covered) / total / 10) / 100,
})

const count = (values: number[]) => metric(values.filter((n) => n > 0).length, values.length)

/** The per-file numbers istanbul's json-summary reporter writes. */
export function summarizeFile(fc: FileCoverage): FileSummary {
  // A line is coverable when a statement starts on it, and covered when any such one ran.
  const lineHits = new Map<number, number>()
  for (const [id, r] of Object.entries(fc.statementMap)) {
    lineHits.set(r.start.line, Math.max(lineHits.get(r.start.line) ?? 0, fc.s[id] ?? 0))
  }
  return {
    lines: count([...lineHits.values()]),
    statements: count(Object.values(fc.s)),
    functions: count(Object.values(fc.f)),
    branches: count(Object.values(fc.b).flat()),
  }
}

export function summarize(map: CoverageMap): Record<string, FileSummary> {
  const files = Object.fromEntries(
    Object.entries(map).map(([path, fc]) => [path, summarizeFile(fc)]),
  )
  const total = {} as FileSummary
  for (const key of ["lines", "statements", "functions", "branches"] as const) {
    let covered = 0
    let all = 0
    for (const summary of Object.values(files)) {
      covered += summary[key].covered
      all += summary[key].total
    }
    total[key] = metric(covered, all)
  }
  return { total, ...files }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [outDir, basePath, ...extraPaths] = process.argv.slice(2)
  if (!outDir || !basePath) {
    process.stderr.write("Usage: merge-coverage.ts <out-dir> <base.json> [extra.json...]\n")
    process.exit(1)
  }
  const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as CoverageMap
  const merged = mergeCoverage(read(basePath), ...extraPaths.map(read))
  const summary = summarize(merged)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, "coverage-final.json"), JSON.stringify(merged))
  writeFileSync(join(outDir, "coverage-summary.json"), JSON.stringify(summary))
  const { lines, statements, functions, branches } = summary.total!
  process.stdout.write(
    `Merged coverage: lines ${lines.pct}%, statements ${statements.pct}%, functions ${functions.pct}%, branches ${branches.pct}%\n`,
  )
}
