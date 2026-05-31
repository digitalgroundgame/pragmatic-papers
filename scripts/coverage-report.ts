// Posts a combined coverage report as a PR comment: project total, per-file coverage
// for changed files, and patch coverage (lines added or modified in this PR's diff).
// Coverage data comes from coverage-summary.json and coverage-final.json (istanbul/v8
// format, produced by `pnpm test:unit:coverage`). It is purely informational — it
// never fails the build.
//
// Changed lines come from the GitHub PR "files" API (its per-file `patch` hunks).
// On non-PR runs (e.g. push to main) there is no diff to measure, so it no-ops.

import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { blue, gray, green, yellow } from "./ansi.mjs"

// ─── Istanbul types ───────────────────────────────────────────────────────────

interface IstanbulLoc {
  start?: { line: number }
  loc?: { start?: { line: number } }
  line?: number
}

interface IstanbulFileCoverage {
  path: string
  statementMap: Record<string, IstanbulLoc>
  s: Record<string, number>
  fnMap: Record<string, { line?: number; decl?: { start?: { line: number } } }>
  f: Record<string, number>
  branchMap: Record<string, IstanbulLoc>
  b: Record<string, number[]>
}

interface SummaryMetric {
  total: number
  covered: number
  skipped: number
  pct: number
}

interface FileSummary {
  lines: SummaryMetric
  statements: SummaryMetric
  functions: SummaryMetric
  branches: SummaryMetric
}

interface CoverageSummaryJson {
  total: FileSummary
  [file: string]: FileSummary
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface MetricCounts {
  covered: number
  total: number
}

interface Metrics {
  lines: MetricCounts
  statements: MetricCounts
  functions: MetricCounts
  branches: MetricCounts
}

interface MetricsWithPct extends Metrics {
  lines: MetricCounts & { pct: number }
  statements: MetricCounts & { pct: number }
  functions: MetricCounts & { pct: number }
  branches: MetricCounts & { pct: number }
}

type MetricKey = keyof Metrics

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMENT_MARKER = "<!-- coverage-report -->"
const STALE_MARKERS = [
  "<!-- patch-coverage-report -->", // old name before script rename
  "<!-- vitest-coverage-report-marker-root -->", // vitest action
]
const METRICS: MetricKey[] = ["lines", "statements", "functions", "branches"]
const LABELS: Record<MetricKey, string> = {
  lines: "Lines",
  statements: "Statements",
  functions: "Functions",
  branches: "Branches",
}

// ─── Pure helpers (exported for unit tests) ───────────────────────────────────

/**
 * Parse a unified-diff `patch` (as returned by the GitHub PR files API) into the
 * set of line numbers added/modified on the NEW side of the file.
 */
export function parseAddedLines(patch: string): Set<number> {
  const added = new Set<number>()
  if (!patch) return added
  let newLine = 0
  let inHunk = false
  for (const line of patch.split("\n")) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (header) {
      newLine = Number(header[1])
      inHunk = true
      continue
    }
    if (!inHunk) continue
    if (line.startsWith("+")) {
      added.add(newLine)
      newLine++
    } else if (line.startsWith("-") || line.startsWith("\\")) {
      // removed line / "No newline at end of file" — no advance on the new side
    } else {
      // context line
      newLine++
    }
  }
  return added
}

/**
 * Re-key an istanbul coverage-final.json (keyed by absolute path) by repo-relative
 * path so it lines up with the filenames GitHub's PR file list returns.
 */
export function indexCoverageByFile(
  finalJson: Record<string, IstanbulFileCoverage>,
  root: string,
): Record<string, IstanbulFileCoverage> {
  const out: Record<string, IstanbulFileCoverage> = {}
  for (const fc of Object.values(finalJson)) {
    out[relative(root, fc.path).split(sep).join("/")] = fc
  }
  return out
}

const emptyCounts = (): Metrics => ({
  lines: { covered: 0, total: 0 },
  statements: { covered: 0, total: 0 },
  functions: { covered: 0, total: 0 },
  branches: { covered: 0, total: 0 },
})

/**
 * Compute line/statement/function/branch coverage for a single file, restricted to
 * `addedLines`. Mirrors istanbul's own metric definitions so the patch numbers are
 * directly comparable to the project total. Returns per-metric counts plus the
 * coverable changed lines that ran zero times (for the "uncovered lines" detail).
 */
export function computeFileMetrics(
  fc: IstanbulFileCoverage,
  addedLines: Set<number>,
): { counts: Metrics; uncoveredLines: number[] } {
  const counts = emptyCounts()
  const uncoveredLines: number[] = []
  const { statementMap = {}, s = {}, fnMap = {}, f = {}, branchMap = {}, b = {} } = fc

  // Lines: coverable when a statement starts on them; covered when any such
  // statement ran. Build a line → max-hits map from statements, as istanbul does.
  const lineHits = new Map<number, number>()
  for (const [id, loc] of Object.entries(statementMap)) {
    const line = loc.start?.line
    if (line == null) continue
    lineHits.set(line, Math.max(lineHits.get(line) ?? 0, s[id] ?? 0))
  }
  for (const line of addedLines) {
    if (!lineHits.has(line)) continue
    counts.lines.total++
    if ((lineHits.get(line) ?? 0) > 0) counts.lines.covered++
    else uncoveredLines.push(line)
  }

  // Statements: counted on their start line.
  for (const [id, loc] of Object.entries(statementMap)) {
    if (!addedLines.has(loc.start?.line ?? -1)) continue
    counts.statements.total++
    if ((s[id] ?? 0) > 0) counts.statements.covered++
  }

  // Functions: counted on their declaration line.
  for (const [id, fn] of Object.entries(fnMap)) {
    if (!addedLines.has(fn.line ?? fn.decl?.start?.line ?? -1)) continue
    counts.functions.total++
    if ((f[id] ?? 0) > 0) counts.functions.covered++
  }

  // Branches: each arm counts individually, on the branch's line.
  for (const [id, br] of Object.entries(branchMap)) {
    if (!addedLines.has(br.line ?? br.loc?.start?.line ?? -1)) continue
    for (const armHits of b[id] ?? []) {
      counts.branches.total++
      if (armHits > 0) counts.branches.covered++
    }
  }

  uncoveredLines.sort((a, z) => a - z)
  return { counts, uncoveredLines }
}

/** Aggregate patch coverage across every changed file. */
export function computePatchCoverage(
  coverageByFile: Record<string, IstanbulFileCoverage>,
  addedLinesByFile: Record<string, Set<number>>,
): { metrics: MetricsWithPct; files: { file: string; uncovered: number[] }[] } {
  const metrics = emptyCounts() as MetricsWithPct
  const files: { file: string; uncovered: number[] }[] = []
  for (const [file, addedLines] of Object.entries(addedLinesByFile)) {
    const fc = coverageByFile[file]
    if (!fc) continue // not instrumented (non-source, excluded, or generated)
    const { counts, uncoveredLines } = computeFileMetrics(fc, addedLines)
    for (const k of METRICS) {
      metrics[k].covered += counts[k].covered
      metrics[k].total += counts[k].total
    }
    if (uncoveredLines.length > 0) files.push({ file, uncovered: uncoveredLines })
  }
  for (const k of METRICS) {
    metrics[k].pct = metrics[k].total === 0 ? 100 : (metrics[k].covered / metrics[k].total) * 100
  }
  return { metrics, files }
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

async function fetchChangedFiles({
  repo,
  prNumber,
  token,
}: {
  repo: string | undefined
  prNumber: number
  token: string | undefined
}): Promise<Record<string, Set<number>>> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "coverage-report-script",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const byFile: Record<string, Set<number>> = {}
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      { headers },
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
    const files = (await res.json()) as { status: string; patch?: string; filename: string }[]
    for (const f of files) {
      if (f.status === "removed" || !f.patch) continue
      byFile[f.filename] = parseAddedLines(f.patch)
    }
    if (files.length < 100) break
  }
  return byFile
}

// ─── Rendering ────────────────────────────────────────────────────────────────

const TABLE_HEADER = `<table>
 <thead><tr>
  <th align="center">Status</th>
  <th align="left">Category</th>
  <th align="right">Percentage</th>
  <th align="right">Covered / Total</th>
 </tr></thead>
 <tbody>`

const TABLE_FOOTER = ` </tbody>
</table>`

export function statusIcon(pct: number): string {
  if (pct >= 80) return "🟢"
  if (pct >= 60) return "🟡"
  return "🔴"
}

export function htmlTable(
  rows: { label: string; pct: number; covered: number; total: number }[],
): string {
  const rowHtml = rows
    .map(
      ({ label, pct, covered, total }) =>
        `  <tr>
   <td align="center">${total === 0 ? "🔵" : statusIcon(pct)}</td>
   <td align="left">${label}</td>
   <td align="right">${total === 0 ? "n/a" : `${pct.toFixed(2)}%`}</td>
   <td align="right">${total === 0 ? "n/a" : `${covered} / ${total}`}</td>
  </tr>`,
    )
    .join("\n")
  return `${TABLE_HEADER}\n${rowHtml}\n${TABLE_FOOTER}`
}

export function deltaIcon(delta: number): string {
  if (delta > 0.001) return "🟢"
  if (delta < -0.001) return "🔴"
  return "🟡"
}

export function renderTotalSection(total: FileSummary, baseTotal: FileSummary | null): string {
  if (!baseTotal) {
    const rows = METRICS.map((k) => ({ label: LABELS[k], ...total[k] }))
    return `<h3>Project total</h3>\n${htmlTable(rows)}`
  }

  const header = `<table>
 <thead><tr>
  <th align="center">Status</th>
  <th align="left">Category</th>
  <th align="right">Percentage</th>
  <th align="right">Covered / Total</th>
  <th align="right">Change</th>
 </tr></thead>
 <tbody>`

  const bodyRows = METRICS.map((k) => {
    const { pct, covered, total: tot } = total[k]
    const delta = pct - baseTotal[k].pct
    const icon = tot === 0 ? "🔵" : deltaIcon(delta)
    const deltaStr =
      tot === 0
        ? "n/a"
        : Math.abs(delta) <= 0.001
          ? "±0.00%"
          : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`
    return `  <tr>
   <td align="center">${icon}</td>
   <td align="left">${LABELS[k]}</td>
   <td align="right">${tot === 0 ? "n/a" : `${pct.toFixed(2)}%`}</td>
   <td align="right">${tot === 0 ? "n/a" : `${covered} / ${tot}`}</td>
   <td align="right">${deltaStr}</td>
  </tr>`
  }).join("\n")

  return `<h3>Project total</h3>\n${header}\n${bodyRows}\n${TABLE_FOOTER}`
}

export function renderFileCoverage({
  summaryJson,
  changedFiles,
  uncoveredMap,
  repo,
  sha,
}: {
  summaryJson: Record<string, FileSummary>
  changedFiles: string[]
  uncoveredMap: Map<string, number[]>
  repo: string | undefined
  sha: string | undefined
}): string | null {
  const rows: string[] = []
  for (const file of changedFiles) {
    const fc = summaryJson[file]
    if (!fc) continue
    const cell = (m: keyof FileSummary) =>
      fc[m].total === 0 ? "n/a" : `${Math.round(fc[m].pct)}% ${fc[m].covered}/${fc[m].total}`
    const fileLink =
      repo && sha
        ? `<a href="https://github.com/${repo}/blob/${sha}/${file}">${file}</a>`
        : `<code>${file}</code>`
    const uncovered = uncoveredMap.get(file) ?? []
    const uncoveredLinks =
      repo && sha
        ? uncovered
            .map((n) => `<a href="https://github.com/${repo}/blob/${sha}/${file}#L${n}">${n}</a>`)
            .join(", ")
        : uncovered.join(", ")
    rows.push(
      `  <tr>
   <td align="left">${fileLink}</td>
   <td align="right">${cell("lines")}</td>
   <td align="right">${cell("statements")}</td>
   <td align="right">${cell("functions")}</td>
   <td align="right">${cell("branches")}</td>
   <td align="left">${uncoveredLinks}</td>
  </tr>`,
    )
  }
  if (rows.length === 0) return null
  const table = `<table>
 <thead><tr>
  <th align="left">File</th>
  <th align="right">Lines</th>
  <th align="right">Statements</th>
  <th align="right">Functions</th>
  <th align="right">Branches</th>
  <th align="left">Uncovered</th>
 </tr></thead>
 <tbody>
${rows.join("\n")}
 </tbody>
</table>`
  return `<details><summary>File Coverage</summary>\n${table}\n</details>`
}

export function renderReport({
  total,
  baseTotal,
  summaryJson,
  metrics,
  files,
  changedFiles,
  repo,
  sha,
}: {
  total: FileSummary | null
  baseTotal: FileSummary | null
  summaryJson: Record<string, FileSummary> | null
  metrics: MetricsWithPct
  files: { file: string; uncovered: number[] }[]
  changedFiles: string[]
  repo: string | undefined
  sha: string | undefined
}): string {
  const rows = METRICS.map((k) => ({ label: LABELS[k], ...metrics[k] }))
  const uncoveredMap = new Map(files.map((f) => [f.file, f.uncovered]))
  const fileCoverage =
    summaryJson && changedFiles
      ? renderFileCoverage({ summaryJson, changedFiles, uncoveredMap, repo, sha })
      : null
  const parts = [
    COMMENT_MARKER,
    "<h2>Coverage Report</h2>",
    ...(total ? ["", renderTotalSection(total, baseTotal)] : []),
    ...(fileCoverage ? ["", fileCoverage] : []),
    "",
    "<h3>Patch coverage</h3>",
    "<p>Lines added or modified in this PR.</p>",
    htmlTable(rows),
  ]
  return parts.join("\n")
}

export async function fetchAllComments(
  repo: string,
  prNumber: number,
  headers: Record<string, string>,
): Promise<{ id: number; body?: string }[]> {
  const all: { id: number; body?: string }[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
      { headers },
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
    const page_ = (await res.json()) as { id: number; body?: string }[]
    all.push(...page_)
    if (page_.length < 100) break
  }
  return all
}

export async function upsertComment({
  repo,
  prNumber,
  token,
  body,
}: {
  repo: string
  prNumber: number
  token: string
  body: string
}): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "coverage-report-script",
    Authorization: `Bearer ${token}`,
  }
  const comments = await fetchAllComments(repo, prNumber, headers)

  // Delete any stale coverage comments (old marker names, vitest action)
  for (const comment of comments) {
    if (STALE_MARKERS.some((m) => comment.body?.includes(m))) {
      const delRes = await fetch(
        `https://api.github.com/repos/${repo}/issues/comments/${comment.id}`,
        { method: "DELETE", headers },
      )
      if (!delRes.ok) console.warn(`${yellow("⚠")} Could not delete stale comment ${comment.id}.`)
    }
  }

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER))
  const url = existing
    ? `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`
  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const finalPath = process.env.COVERAGE_FINAL_PATH ?? "coverage/coverage-final.json"
  const summaryPath = process.env.COVERAGE_SUMMARY_PATH ?? "coverage/coverage-summary.json"
  const root = process.env.GITHUB_WORKSPACE ?? process.cwd()

  const eventPath = process.env.GITHUB_EVENT_PATH
  const event =
    eventPath && existsSync(eventPath) ? JSON.parse(readFileSync(eventPath, "utf8")) : {}
  const prNumber: number | undefined = event.pull_request?.number
  if (!prNumber) {
    console.warn(`${blue("●")} Not a pull request — skipping coverage report.`)
    return
  }
  if (!existsSync(finalPath)) {
    console.warn(`${yellow("⚠")} ${finalPath} not found — run \`pnpm test:unit:coverage\` first.`)
    return
  }

  const coverageByFile = indexCoverageByFile(
    JSON.parse(readFileSync(finalPath, "utf8")) as Record<string, IstanbulFileCoverage>,
    root,
  )
  const summaryRaw: CoverageSummaryJson | null = existsSync(summaryPath)
    ? (JSON.parse(readFileSync(summaryPath, "utf8")) as CoverageSummaryJson)
    : null
  if (!summaryRaw)
    console.warn(
      `${yellow("⚠")} ${summaryPath} not found — skipping project total and file coverage sections.`,
    )
  const total = summaryRaw?.total ?? null

  const baseSummaryPath = process.env.BASE_COVERAGE_SUMMARY_PATH
  const baseSummaryRaw: CoverageSummaryJson | null =
    baseSummaryPath && existsSync(baseSummaryPath)
      ? (JSON.parse(readFileSync(baseSummaryPath, "utf8")) as CoverageSummaryJson)
      : null
  if (baseSummaryPath && !baseSummaryRaw)
    console.warn(
      `${yellow("⚠")} BASE_COVERAGE_SUMMARY_PATH set but file not found — skipping delta.`,
    )
  const baseTotal = baseSummaryRaw?.total ?? null

  const repo = process.env.GITHUB_REPOSITORY
  const sha = process.env.GITHUB_SHA
  const token = process.env.GITHUB_TOKEN
  const addedLinesByFile = await fetchChangedFiles({ repo, prNumber, token })
  const { metrics, files } = computePatchCoverage(coverageByFile, addedLinesByFile)

  if (metrics.lines.total === 0) {
    console.warn(`${gray("○")} Patch coverage: n/a (no executable changed lines)`)
  } else {
    console.warn(
      `${green("●")} Patch coverage — ` +
        METRICS.map((k) => `${LABELS[k].toLowerCase()} ${metrics[k].pct.toFixed(2)}%`).join(", "),
    )
  }

  // Re-key by repo-relative path (summary keys are absolute, like coverage-final.json)
  const summaryByFile: Record<string, FileSummary> | null = summaryRaw
    ? Object.fromEntries(
        Object.entries(summaryRaw)
          .filter(([k]) => k !== "total")
          .map(([k, v]) => [relative(root, k).split(sep).join("/"), v]),
      )
    : null
  const changedFiles = Object.keys(addedLinesByFile)
  const report = renderReport({
    total,
    baseTotal,
    summaryJson: summaryByFile,
    metrics,
    files,
    changedFiles,
    repo,
    sha,
  })
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n")
  }
  if (token && repo) {
    try {
      await upsertComment({ repo, prNumber, token, body: report })
    } catch (err) {
      console.warn(`${yellow("⚠")} Could not post PR comment: ${(err as Error).message}`)
    }
  }
}

// Only run when invoked directly, so the pure helpers above can be unit-tested.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
