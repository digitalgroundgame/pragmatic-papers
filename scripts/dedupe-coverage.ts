// Collapses the duplicate entries a merged coverage report gets when the same file was
// instrumented twice: once by the unit tests in Node, once by the story tests in Chromium.
// The two source maps give a function or branch the same start but can disagree on its end
// (one has a column, the other `null`), and istanbul's merge keys entries by their whole
// location, so the merged file lists both and the function counts in the report double.
//
// Entries that start at the same place are one entry: their hit counts are added. Then
// coverage-summary.json is rebuilt from the cleaned coverage-final.json.
//
// Usage: tsx scripts/dedupe-coverage.ts [coverage-dir]   (default: coverage)

import { readFileSync, writeFileSync } from "node:fs"
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

interface FileCoverage {
  path: string
  statementMap: Record<string, Range>
  s: Record<string, number>
  fnMap: Record<string, { name: string; decl: Range; loc: Range; line: number }>
  f: Record<string, number>
  branchMap: Record<string, { type: string; loc: Range; locations: Range[]; line: number }>
  b: Record<string, number[]>
  [key: string]: unknown
}

type CoverageMap = Record<string, FileCoverage>

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

const at = (p: Position) => `${p.line}:${p.column}`

/** Groups `map` by `keyOf`, keeping the first entry of each group and combining the hits. */
function collapse<E, H>(
  map: Record<string, E>,
  hits: Record<string, H>,
  keyOf: (entry: E) => string,
  add: (a: H, b: H) => H,
): { map: Record<string, E>; hits: Record<string, H> } {
  const groups = new Map<string, { entry: E; hits: H }>()
  for (const [id, entry] of Object.entries(map)) {
    const key = keyOf(entry)
    const hit = hits[id] as H
    const group = groups.get(key)
    if (group) group.hits = add(group.hits, hit)
    else groups.set(key, { entry, hits: hit })
  }
  const out = { map: {} as Record<string, E>, hits: {} as Record<string, H> }
  let i = 0
  for (const { entry, hits: hit } of groups.values()) {
    out.map[i] = entry
    out.hits[i] = hit
    i++
  }
  return out
}

export function dedupeFile(fc: FileCoverage): FileCoverage {
  const statements = collapse(
    fc.statementMap,
    fc.s,
    (r) => at(r.start),
    (a, b) => a + b,
  )
  const functions = collapse(
    fc.fnMap,
    fc.f,
    (fn) => at(fn.decl.start),
    (a, b) => a + b,
  )
  // Arms are added pairwise, so only branches with the same number of arms are one branch.
  const branches = collapse(
    fc.branchMap,
    fc.b,
    (br) => `${at(br.loc.start)}:${br.type}:${br.locations.length}`,
    (a, b) => a.map((n, i) => n + (b[i] ?? 0)),
  )
  return {
    ...fc,
    statementMap: statements.map,
    s: statements.hits,
    fnMap: functions.map,
    f: functions.hits,
    branchMap: branches.map,
    b: branches.hits,
  }
}

const metric = (covered: number, total: number): Metric => ({
  total,
  covered,
  skipped: 0,
  // istanbul's rounding, and 100% for a file with nothing to cover
  pct: total === 0 ? 100 : Math.floor((covered / total) * 10_000) / 100,
})

/** The per-file numbers istanbul's json-summary reporter writes. */
export function summarizeFile(fc: FileCoverage): FileSummary {
  const lineHits = new Map<number, number>()
  for (const [id, r] of Object.entries(fc.statementMap)) {
    lineHits.set(r.start.line, Math.max(lineHits.get(r.start.line) ?? 0, fc.s[id] ?? 0))
  }
  const lineValues = [...lineHits.values()]
  const statementValues = Object.values(fc.s)
  const functionValues = Object.values(fc.f)
  const arms = Object.values(fc.b).flat()
  const count = (values: number[]) => metric(values.filter((n) => n > 0).length, values.length)
  return {
    lines: count(lineValues),
    statements: count(statementValues),
    functions: count(functionValues),
    branches: count(arms),
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

export function dedupeCoverage(map: CoverageMap): CoverageMap {
  return Object.fromEntries(Object.entries(map).map(([path, fc]) => [path, dedupeFile(fc)]))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2] ?? "coverage"
  const finalPath = join(dir, "coverage-final.json")
  const map = dedupeCoverage(JSON.parse(readFileSync(finalPath, "utf8")) as CoverageMap)
  const summary = summarize(map)
  writeFileSync(finalPath, JSON.stringify(map))
  writeFileSync(join(dir, "coverage-summary.json"), JSON.stringify(summary))
  const { lines, statements, functions, branches } = summary.total!
  process.stdout.write(
    `Deduplicated coverage: lines ${lines.pct}%, statements ${statements.pct}%, functions ${functions.pct}%, branches ${branches.pct}%\n`,
  )
}
