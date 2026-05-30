// Reports Codecov-style "patch" coverage: the percentage of lines ADDED or
// MODIFIED in this PR's diff that are covered by tests. The davelosert coverage
// action reports the project total but has no aggregate patch number, so this
// script computes and posts the patch figure alongside the total. It is purely
// informational — it never fails the build.
//
// Line hits come from coverage/lcov.info (produced by `pnpm test:unit:coverage`);
// changed lines come from the GitHub PR "files" API (its per-file `patch` hunks).
// On non-PR runs (e.g. push to main) there is no diff to measure, so it no-ops.

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { blue, gray, green, yellow } from "./ansi.mjs"

const COMMENT_MARKER = "<!-- patch-coverage-report -->"

/**
 * Parse an lcov report into `{ "src/file.ts": Map<lineNumber, hits> }`.
 * @param {string} lcov
 * @returns {Record<string, Map<number, number>>}
 */
export function parseLcov(lcov) {
  const files = {}
  let current = null
  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      current = line.slice(3).trim()
      files[current] = new Map()
    } else if (line.startsWith("DA:") && current) {
      const [lineNo, hits] = line.slice(3).split(",")
      files[current].set(Number(lineNo), Number(hits))
    } else if (line === "end_of_record") {
      current = null
    }
  }
  return files
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
 * Intersect changed lines with covered lines. Only lines that lcov tracked
 * (executable lines) count toward the denominator — blank lines, comments and
 * type-only lines are naturally excluded because lcov never emits a `DA:` for them.
 * @param {Record<string, Map<number, number>>} lineHitsByFile
 * @param {Record<string, Set<number>>} addedLinesByFile
 */
export function computePatchCoverage(lineHitsByFile, addedLinesByFile) {
  let covered = 0
  let total = 0
  const files = []
  for (const [file, addedLines] of Object.entries(addedLinesByFile)) {
    const lineHits = lineHitsByFile[file]
    if (!lineHits) continue // not instrumented (non-source, excluded, or generated)
    let fileCovered = 0
    const uncovered = []
    for (const lineNo of addedLines) {
      if (!lineHits.has(lineNo)) continue // not an executable line
      if (lineHits.get(lineNo) > 0) fileCovered++
      else uncovered.push(lineNo)
    }
    const fileTotal = fileCovered + uncovered.length
    if (fileTotal === 0) continue
    covered += fileCovered
    total += fileTotal
    files.push({ file, covered: fileCovered, total: fileTotal, uncovered })
  }
  const pct = total === 0 ? 100 : (covered / total) * 100
  return { covered, total, pct, files }
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

function renderReport({ result, totalPct }) {
  const pct = (n) => (Number.isNaN(n) ? "n/a" : `${n.toFixed(2)}%`)
  const patchCell =
    result.total === 0
      ? "n/a (no changed lines)"
      : `${pct(result.pct)} (${result.covered}/${result.total})`
  const lines = [
    COMMENT_MARKER,
    "## Coverage",
    "",
    "| Scope | Coverage |",
    "| --- | --- |",
    `| **Total** (whole project) | ${pct(totalPct)} |`,
    `| **Patch** (lines changed in this PR) | ${patchCell} |`,
  ]
  const withGaps = result.files.filter((f) => f.uncovered.length > 0)
  if (withGaps.length > 0) {
    lines.push("", "<details><summary>Uncovered changed lines</summary>", "")
    for (const f of withGaps) {
      lines.push(`- \`${f.file}\`: ${f.uncovered.join(", ")}`)
    }
    lines.push("", "</details>")
  }
  return lines.join("\n")
}

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
  const existing = (await listRes.json()).find((c) => c.body?.includes(COMMENT_MARKER))
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
  const lcovPath = process.env.LCOV_PATH ?? "coverage/lcov.info"
  const summaryPath = process.env.COVERAGE_SUMMARY_PATH ?? "coverage/coverage-summary.json"

  const eventPath = process.env.GITHUB_EVENT_PATH
  const event =
    eventPath && existsSync(eventPath) ? JSON.parse(readFileSync(eventPath, "utf8")) : {}
  const prNumber = event.pull_request?.number
  if (!prNumber) {
    console.warn(`${blue("●")} Not a pull request — skipping patch coverage report.`)
    return
  }

  if (!existsSync(lcovPath)) {
    console.warn(`${yellow("⚠")} ${lcovPath} not found — run \`pnpm test:unit:coverage\` first.`)
    return
  }

  const lineHitsByFile = parseLcov(readFileSync(lcovPath, "utf8"))
  const totalPct = existsSync(summaryPath)
    ? JSON.parse(readFileSync(summaryPath, "utf8")).total.lines.pct
    : NaN

  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  const addedLinesByFile = await fetchChangedFiles({ repo, prNumber, token })
  const result = computePatchCoverage(lineHitsByFile, addedLinesByFile)

  console.warn(
    `${blue("●")} Total coverage: ${Number.isNaN(totalPct) ? "n/a" : totalPct.toFixed(2) + "%"}`,
  )
  if (result.total === 0) {
    console.warn(`${gray("○")} Patch coverage: n/a (no executable changed lines)`)
  } else {
    console.warn(
      `${green("●")} Patch coverage: ${result.pct.toFixed(2)}% (${result.covered}/${result.total} changed lines)`,
    )
  }

  const report = renderReport({ result, totalPct })
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
