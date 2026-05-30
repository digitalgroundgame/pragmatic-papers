// Reports Codecov-style "patch" coverage: how well the lines ADDED or MODIFIED in
// this PR's diff are covered by tests, broken down by lines/statements/functions/
// branches (the same metrics the davelosert action reports for the project total).
// The project total is left to that action; this script focuses only on the patch.
// It is purely informational — it never fails the build.
//
// Coverage comes from coverage/coverage-final.json (istanbul format, produced by
// `pnpm test:unit:coverage`); changed lines come from the GitHub PR "files" API
// (its per-file `patch` hunks). On non-PR runs (e.g. push to main) there is no
// diff to measure, so it no-ops.

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { blue, gray, green, yellow } from "./ansi.mjs"

const COMMENT_MARKER = "<!-- patch-coverage-report -->"
const METRICS = ["lines", "statements", "functions", "branches"]
const LABELS = {
  lines: "Lines",
  statements: "Statements",
  functions: "Functions",
  branches: "Branches",
}

/**
 * Parse a unified-diff `patch` (as returned by the GitHub PR files API) into the
 * set of line numbers added/modified on the NEW side of the file.
 * @param {string} patch
 * @returns {Set<number>}
 */
export function parseAddedLines(patch) {
  const added = new Set()
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
 * @param {Record<string, any>} finalJson
 * @param {string} root
 * @returns {Record<string, any>}
 */
export function indexCoverageByFile(finalJson, root) {
  const out = {}
  for (const fc of Object.values(finalJson)) {
    out[relative(root, fc.path).split(sep).join("/")] = fc
  }
  return out
}

const emptyCounts = () => ({
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
 * @param {any} fc istanbul file coverage object
 * @param {Set<number>} addedLines
 */
export function computeFileMetrics(fc, addedLines) {
  const counts = emptyCounts()
  const uncoveredLines = []
  const { statementMap = {}, s = {}, fnMap = {}, f = {}, branchMap = {}, b = {} } = fc

  // Lines: coverable when a statement starts on them; covered when any such
  // statement ran. Build a line → max-hits map from statements, as istanbul does.
  const lineHits = new Map()
  for (const [id, loc] of Object.entries(statementMap)) {
    const line = loc.start?.line
    if (line == null) continue
    lineHits.set(line, Math.max(lineHits.get(line) ?? 0, s[id] ?? 0))
  }
  for (const line of addedLines) {
    if (!lineHits.has(line)) continue
    counts.lines.total++
    if (lineHits.get(line) > 0) counts.lines.covered++
    else uncoveredLines.push(line)
  }

  // Statements: counted on their start line.
  for (const [id, loc] of Object.entries(statementMap)) {
    if (!addedLines.has(loc.start?.line)) continue
    counts.statements.total++
    if ((s[id] ?? 0) > 0) counts.statements.covered++
  }

  // Functions: counted on their declaration line.
  for (const [id, fn] of Object.entries(fnMap)) {
    if (!addedLines.has(fn.line ?? fn.decl?.start?.line)) continue
    counts.functions.total++
    if ((f[id] ?? 0) > 0) counts.functions.covered++
  }

  // Branches: each arm counts individually, on the branch's line.
  for (const [id, br] of Object.entries(branchMap)) {
    if (!addedLines.has(br.line ?? br.loc?.start?.line)) continue
    for (const armHits of b[id] ?? []) {
      counts.branches.total++
      if (armHits > 0) counts.branches.covered++
    }
  }

  uncoveredLines.sort((a, z) => a - z)
  return { counts, uncoveredLines }
}

/**
 * Aggregate patch coverage across every changed file.
 * @param {Record<string, any>} coverageByFile
 * @param {Record<string, Set<number>>} addedLinesByFile
 * @returns {{
 *   metrics: {
 *     lines: { covered: number, total: number, pct: number },
 *     statements: { covered: number, total: number, pct: number },
 *     functions: { covered: number, total: number, pct: number },
 *     branches: { covered: number, total: number, pct: number },
 *   },
 *   files: { file: string, uncovered: number[] }[],
 * }}
 */
export function computePatchCoverage(coverageByFile, addedLinesByFile) {
  const metrics = emptyCounts()
  const files = []
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

async function fetchChangedFiles({ repo, prNumber, token }) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "patch-coverage-script",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const byFile = {}
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      { headers },
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
    const files = await res.json()
    for (const f of files) {
      if (f.status === "removed" || !f.patch) continue
      byFile[f.filename] = parseAddedLines(f.patch)
    }
    if (files.length < 100) break
  }
  return byFile
}

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

function statusIcon(pct) {
  if (pct >= 80) return "🟢"
  if (pct >= 60) return "🟡"
  return "🔴"
}

function htmlTable(rows) {
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

function renderTotalSection(total) {
  const rows = METRICS.map((k) => ({ label: LABELS[k], ...total[k] }))
  return `<h3>Project total</h3>\n${htmlTable(rows)}`
}

// Columns mirror the vitest-coverage-report-action file coverage table.
// summaryJson  — full coverage-summary.json (keyed by repo-relative path)
// changedFiles — Set keys from addedLinesByFile (all files touched in the PR)
// uncoveredMap — Map<file, number[]> from computePatchCoverage files array
// repo / sha   — for GitHub file links (optional; omitted when not in CI)
function renderFileCoverage({ summaryJson, changedFiles, uncoveredMap, repo, sha }) {
  const rows = []
  for (const file of changedFiles) {
    const fc = summaryJson[file]
    if (!fc) continue
    const pct = (m) => (fc[m].total === 0 ? "n/a" : `${fc[m].pct.toFixed(2)}%`)
    const fileLink =
      repo && sha
        ? `<a href="https://github.com/${repo}/blob/${sha}/${file}">${file}</a>`
        : `<code>${file}</code>`
    const uncovered = uncoveredMap.get(file) ?? []
    rows.push(
      `  <tr>
   <td align="left">${fileLink}</td>
   <td align="right">${pct("statements")}</td>
   <td align="right">${pct("branches")}</td>
   <td align="right">${pct("functions")}</td>
   <td align="right">${pct("lines")}</td>
   <td align="left">${uncovered.join(", ")}</td>
  </tr>`,
    )
  }
  if (rows.length === 0) return null
  const table = `<table>
 <thead><tr>
  <th align="left">File</th>
  <th align="right">Stmts</th>
  <th align="right">Branches</th>
  <th align="right">Functions</th>
  <th align="right">Lines</th>
  <th align="left">Uncovered Lines</th>
 </tr></thead>
 <tbody>
${rows.join("\n")}
 </tbody>
</table>`
  return `<details open><summary>File Coverage</summary>\n${table}\n</details>`
}

function renderReport({ total, summaryJson, metrics, files, changedFiles, repo, sha }) {
  const rows = METRICS.map((k) => ({ label: LABELS[k], ...metrics[k] }))
  const uncoveredMap = new Map(files.map((f) => [f.file, f.uncovered]))
  const fileCoverage =
    summaryJson && changedFiles
      ? renderFileCoverage({ summaryJson, changedFiles, uncoveredMap, repo, sha })
      : null
  const parts = [
    COMMENT_MARKER,
    "<h2>Coverage Report</h2>",
    ...(total ? ["", renderTotalSection(total)] : []),
    ...(fileCoverage ? ["", fileCoverage] : []),
    "",
    "<h3>Patch coverage</h3>",
    "<p>Lines added or modified in this PR.</p>",
    htmlTable(rows),
  ]
  const withGaps = files.filter((f) => f.uncovered.length > 0)
  if (withGaps.length > 0) {
    const items = withGaps.map((f) => `  <li><code>${f.file}</code>: ${f.uncovered.join(", ")}</li>`)
    parts.push(
      "",
      "<details><summary>Uncovered changed lines</summary>",
      "<ul>",
      ...items,
      "</ul>",
      "</details>",
    )
  }
  return parts.join("\n")
}

const VITEST_ACTION_MARKER = "<!-- vitest-coverage-report-marker-root -->"

async function upsertComment({ repo, prNumber, token, body }) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "patch-coverage-script",
    Authorization: `Bearer ${token}`,
  }
  const listRes = await fetch(
    `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
    { headers },
  )
  if (!listRes.ok) throw new Error(`GitHub API ${listRes.status}: ${await listRes.text()}`)
  const comments = await listRes.json()

  // Delete the stale vitest-coverage-report-action comment if it still exists
  const stale = comments.find((c) => c.body?.includes(VITEST_ACTION_MARKER))
  if (stale) {
    const delRes = await fetch(
      `https://api.github.com/repos/${repo}/issues/comments/${stale.id}`,
      { method: "DELETE", headers },
    )
    if (!delRes.ok) console.warn(`${yellow("⚠")} Could not delete stale vitest action comment.`)
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

async function main() {
  const finalPath = process.env.COVERAGE_FINAL_PATH ?? "coverage/coverage-final.json"
  const summaryPath = process.env.COVERAGE_SUMMARY_PATH ?? "coverage/coverage-summary.json"
  const root = process.env.GITHUB_WORKSPACE ?? process.cwd()

  const eventPath = process.env.GITHUB_EVENT_PATH
  const event =
    eventPath && existsSync(eventPath) ? JSON.parse(readFileSync(eventPath, "utf8")) : {}
  const prNumber = event.pull_request?.number
  if (!prNumber) {
    console.warn(`${blue("●")} Not a pull request — skipping patch coverage report.`)
    return
  }
  if (!existsSync(finalPath)) {
    console.warn(`${yellow("⚠")} ${finalPath} not found — run \`pnpm test:unit:coverage\` first.`)
    return
  }

  const coverageByFile = indexCoverageByFile(JSON.parse(readFileSync(finalPath, "utf8")), root)
  const summaryJson = existsSync(summaryPath)
    ? JSON.parse(readFileSync(summaryPath, "utf8"))
    : null
  if (!summaryJson)
    console.warn(`${yellow("⚠")} ${summaryPath} not found — skipping project total and file coverage sections.`)
  const total = summaryJson?.total ?? null

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
  const summaryByFile = summaryJson ? Object.fromEntries(
    Object.entries(summaryJson)
      .filter(([k]) => k !== "total")
      .map(([k, v]) => [relative(root, k).split(sep).join("/"), v])
  ) : null
  const changedFiles = Object.keys(addedLinesByFile)
  const report = renderReport({ total, summaryJson: summaryByFile, metrics, files, changedFiles, repo, sha })
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n")
  }
  if (token && repo) {
    try {
      await upsertComment({ repo, prNumber, token, body: report })
    } catch (err) {
      console.warn(`${yellow("⚠")} Could not post PR comment: ${err.message}`)
    }
  }
}

// Only run when invoked directly, so the pure helpers above can be unit-tested.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
