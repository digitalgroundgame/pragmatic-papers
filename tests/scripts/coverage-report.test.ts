import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  computeFileMetrics,
  computePatchCoverage,
  deltaIcon,
  fetchAllComments,
  fetchChangedFiles,
  htmlTable,
  indexCoverageByFile,
  main,
  parseAddedLines,
  renderFileCoverage,
  renderPatchUncovered,
  renderReport,
  renderTotalSection,
  statusIcon,
  toLineRanges,
  upsertComment,
} from "../../scripts/coverage-report"

// Minimal FileSummary fixture
function summary(pct: number, covered = Math.round(pct), total = 100) {
  const m = { total, covered, skipped: 0, pct }
  return { lines: m, statements: m, functions: m, branches: m }
}

// Zero-coverage MetricsWithPct fixture for renderReport
const emptyMetrics = {
  lines: { covered: 0, total: 0, pct: 100 },
  statements: { covered: 0, total: 0, pct: 100 },
  functions: { covered: 0, total: 0, pct: 100 },
  branches: { covered: 0, total: 0, pct: 100 },
}

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

  it("ignores lines before the first hunk header", () => {
    const patch = ["--- a/src/foo.ts", "+++ b/src/foo.ts", "@@ -1,1 +1,2 @@", "+added"].join("\n")
    expect([...parseAddedLines(patch)]).toEqual([1])
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
    expect(deltaIcon(0.006)).toBe("🟢") // just above threshold (rounds to +0.01%)
  })

  it("returns 🔵 when coverage is neutral or zero (rounds to ±0.00% at 2dp)", () => {
    expect(deltaIcon(0)).toBe("🔵")
    expect(deltaIcon(0.004)).toBe("🔵") // rounds to 0.00%
    expect(deltaIcon(-0.004)).toBe("🔵") // rounds to 0.00%
  })

  it("returns 🟡 when coverage dropped a little (< 1%)", () => {
    expect(deltaIcon(-0.006)).toBe("🟡") // just below neutral threshold (rounds to -0.01%)
    expect(deltaIcon(-0.5)).toBe("🟡")
    expect(deltaIcon(-0.999)).toBe("🟡") // just above big-drop threshold
  })

  it("returns 🔴 when coverage dropped a lot (≥ 1%)", () => {
    expect(deltaIcon(-1.0)).toBe("🔴")
    expect(deltaIcon(-5)).toBe("🔴")
  })
})

describe("renderTotalSection", () => {
  it("renders absolute-threshold dots when no base is provided", () => {
    const html = renderTotalSection(summary(85), null)
    expect(html).toContain("🟢") // 85% ≥ 80
    expect(html).not.toContain("Change")
  })

  it("shows 🟢 and a positive delta when coverage improved", () => {
    const html = renderTotalSection(summary(85), summary(80))
    expect(html).toContain("🟢")
    expect(html).toContain("+5.00%")
    expect(html).toContain("Change")
  })

  it("shows 🔴 and a negative delta when coverage worsened", () => {
    const html = renderTotalSection(summary(75), summary(80))
    expect(html).toContain("🔴")
    expect(html).toContain("-5.00%")
  })

  it("shows 🔵 and ±0.00% when coverage is unchanged", () => {
    const html = renderTotalSection(summary(80), summary(80))
    expect(html).toContain("🔵")
    expect(html).toContain("±0.00%")
  })

  it("shows 🟡 and a small negative delta when coverage dropped slightly", () => {
    const html = renderTotalSection(summary(79.5), summary(80))
    expect(html).toContain("🟡")
    expect(html).toContain("-0.50%")
  })

  it("shows 🔵 and n/a for metrics with no coverable lines", () => {
    const html = renderTotalSection(summary(0, 0, 0), summary(0, 0, 0))
    expect(html).toContain("🔵")
    // every data cell should be n/a
    expect(html.match(/n\/a/g)?.length).toBeGreaterThanOrEqual(4)
  })
})

describe("statusIcon", () => {
  it("returns 🟢 at or above 80%", () => {
    expect(statusIcon(100)).toBe("🟢")
    expect(statusIcon(80)).toBe("🟢")
  })

  it("returns 🟡 between 60% and 79%", () => {
    expect(statusIcon(79)).toBe("🟡")
    expect(statusIcon(60)).toBe("🟡")
  })

  it("returns 🔴 below 60%", () => {
    expect(statusIcon(59)).toBe("🔴")
    expect(statusIcon(0)).toBe("🔴")
  })
})

describe("htmlTable", () => {
  it("renders a row with percentage and covered/total", () => {
    const html = htmlTable([{ label: "Lines", pct: 85, covered: 85, total: 100 }])
    expect(html).toContain("🟢")
    expect(html).toContain("85.00%")
    expect(html).toContain("85 / 100")
    expect(html).toContain("Lines")
  })

  it("renders n/a and 🔵 for rows with no coverable items", () => {
    const html = htmlTable([{ label: "Functions", pct: 0, covered: 0, total: 0 }])
    expect(html).toContain("🔵")
    expect(html).toContain("n/a")
    expect(html).not.toContain("0.00%")
  })
})

describe("renderFileCoverage", () => {
  const fileSummary = summary(78, 7, 9)
  const summaryJson = { "src/foo.ts": fileSummary }

  it("returns null when no changed files have coverage data", () => {
    expect(
      renderFileCoverage({
        summaryJson,
        changedFiles: ["src/untracked.ts"],
        repo: undefined,
        sha: undefined,
      }),
    ).toBeNull()
  })

  it("renders a file row with plain code tag when repo/sha are absent", () => {
    const html = renderFileCoverage({
      summaryJson,
      changedFiles: ["src/foo.ts"],
      repo: undefined,
      sha: undefined,
    })
    expect(html).toContain("<code>src/foo.ts</code>")
    expect(html).toContain("Touched files")
  })

  it("renders a file link when repo and sha are provided", () => {
    const html = renderFileCoverage({
      summaryJson,
      changedFiles: ["src/foo.ts"],
      repo: "owner/repo",
      sha: "abc123",
    })
    expect(html).toContain(
      `<a href="https://github.com/owner/repo/blob/abc123/src/foo.ts">src/foo.ts</a>`,
    )
  })

  it("does not include an uncovered-lines column", () => {
    const html = renderFileCoverage({
      summaryJson,
      changedFiles: ["src/foo.ts"],
      repo: undefined,
      sha: undefined,
    })
    expect(html).not.toContain("Uncovered")
  })

  it("renders n/a for a metric whose total is zero", () => {
    const zeroFunctions = {
      "src/foo.ts": {
        lines: { total: 9, covered: 7, skipped: 0, pct: 78 },
        statements: { total: 13, covered: 10, skipped: 0, pct: 77 },
        functions: { total: 0, covered: 0, skipped: 0, pct: 100 },
        branches: { total: 14, covered: 13, skipped: 0, pct: 93 },
      },
    }
    const html = renderFileCoverage({
      summaryJson: zeroFunctions,
      changedFiles: ["src/foo.ts"],
      repo: undefined,
      sha: undefined,
    })
    expect(html).toContain("n/a")
  })
})

describe("toLineRanges", () => {
  it("collapses consecutive numbers into a single range", () => {
    expect(toLineRanges([5, 6, 7])).toEqual([{ start: 5, end: 7 }])
  })

  it("keeps non-adjacent numbers as separate ranges", () => {
    expect(toLineRanges([5, 6, 7, 10, 11, 20])).toEqual([
      { start: 5, end: 7 },
      { start: 10, end: 11 },
      { start: 20, end: 20 },
    ])
  })

  it("sorts and de-dupes before ranging", () => {
    expect(toLineRanges([7, 5, 6, 6])).toEqual([{ start: 5, end: 7 }])
  })

  it("returns an empty array for no lines", () => {
    expect(toLineRanges([])).toEqual([])
  })
})

describe("renderPatchUncovered", () => {
  it("returns null when there are no uncovered lines", () => {
    expect(renderPatchUncovered({ files: [], repo: undefined, sha: undefined })).toBeNull()
  })

  it("renders per-file patch coverage and uncovered ranges as plain text without repo/sha", () => {
    const html = renderPatchUncovered({
      files: [
        { file: "src/foo.ts", lines: { covered: 6, total: 10, pct: 60 }, uncovered: [5, 6, 7, 10] },
      ],
      repo: undefined,
      sha: undefined,
    })
    expect(html).toContain("<code>src/foo.ts</code>")
    expect(html).toContain("Patch coverage")
    expect(html).toContain("60% 6/10") // per-file patch line coverage
    expect(html).toContain("5-7, 10") // uncovered subset
    expect(html).not.toContain("<a href")
  })

  it("renders n/a when the file has no coverable patch lines", () => {
    const html = renderPatchUncovered({
      files: [{ file: "src/foo.ts", lines: { covered: 0, total: 0, pct: 100 }, uncovered: [] }],
      repo: undefined,
      sha: undefined,
    })
    expect(html).toContain("n/a")
  })

  it("links a multi-line range to a GitHub line range", () => {
    const html = renderPatchUncovered({
      files: [
        { file: "src/foo.ts", lines: { covered: 0, total: 3, pct: 0 }, uncovered: [5, 6, 7] },
      ],
      repo: "owner/repo",
      sha: "abc123",
    })
    expect(html).toContain(
      `<a href="https://github.com/owner/repo/blob/abc123/src/foo.ts#L5-L7">5-7</a>`,
    )
  })

  it("links a single uncovered line to a single-line anchor", () => {
    const html = renderPatchUncovered({
      files: [{ file: "src/foo.ts", lines: { covered: 0, total: 1, pct: 0 }, uncovered: [42] }],
      repo: "owner/repo",
      sha: "abc123",
    })
    expect(html).toContain(
      `<a href="https://github.com/owner/repo/blob/abc123/src/foo.ts#L42">42</a>`,
    )
  })
})

describe("renderReport", () => {
  it("always includes the comment marker and patch coverage section", () => {
    const html = renderReport({
      total: null,
      baseTotal: null,
      summaryJson: null,
      metrics: emptyMetrics,
      files: [],
      changedFiles: [],
      repo: undefined,
      sha: undefined,
    })
    expect(html).toContain("<!-- coverage-report -->")
    expect(html).toContain("Patch coverage")
  })

  it("omits the project total section when total is null", () => {
    const html = renderReport({
      total: null,
      baseTotal: null,
      summaryJson: null,
      metrics: emptyMetrics,
      files: [],
      changedFiles: [],
      repo: undefined,
      sha: undefined,
    })
    expect(html).not.toContain("Project total")
  })

  it("includes the project total section when total is provided", () => {
    const html = renderReport({
      total: summary(75),
      baseTotal: null,
      summaryJson: null,
      metrics: emptyMetrics,
      files: [],
      changedFiles: [],
      repo: undefined,
      sha: undefined,
    })
    expect(html).toContain("Project total")
  })

  it("includes the file coverage section when changed files have summary data", () => {
    const html = renderReport({
      total: summary(75),
      baseTotal: null,
      summaryJson: { "src/foo.ts": summary(78) },
      metrics: emptyMetrics,
      files: [],
      changedFiles: ["src/foo.ts"],
      repo: undefined,
      sha: undefined,
    })
    expect(html).toContain("Touched files")
    expect(html).toContain("src/foo.ts")
  })

  it("lists uncovered patch lines as ranges under the patch coverage section", () => {
    const html = renderReport({
      total: summary(75),
      baseTotal: null,
      summaryJson: { "src/foo.ts": summary(78) },
      metrics: emptyMetrics,
      files: [
        { file: "src/foo.ts", lines: { covered: 0, total: 4, pct: 0 }, uncovered: [5, 6, 7, 12] },
      ],
      changedFiles: ["src/foo.ts"],
      repo: undefined,
      sha: undefined,
    })
    const patchIdx = html.indexOf("Patch coverage")
    expect(patchIdx).toBeGreaterThanOrEqual(0)
    expect(html).toContain("Uncovered patch lines")
    // the ranges render after the patch coverage heading
    expect(html.indexOf("5-7, 12")).toBeGreaterThan(patchIdx)
  })

  it("omits the file coverage section when no changed files have summary data", () => {
    const html = renderReport({
      total: summary(75),
      baseTotal: null,
      summaryJson: { "src/foo.ts": summary(78) },
      metrics: emptyMetrics,
      files: [],
      changedFiles: ["src/untracked.ts"],
      repo: undefined,
      sha: undefined,
    })
    expect(html).not.toContain("Touched files")
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
    expect(result.files).toEqual([
      { file: "src/a.ts", lines: { covered: 2, total: 3, pct: (2 / 3) * 100 }, uncovered: [2] },
    ])
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

// ─── GitHub API helpers ────────────────────────────────────────────────────────

function mockRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe("fetchAllComments", () => {
  const headers = { Authorization: "Bearer token" }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it("returns comments from a single page", async () => {
    const comments = [{ id: 1, body: "hello" }]
    vi.mocked(fetch).mockResolvedValueOnce(mockRes(comments) as Response)
    const result = await fetchAllComments("owner/repo", 42, headers)
    expect(result).toEqual(comments)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("paginates until a page returns fewer than 100 comments", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const page2 = [{ id: 100, body: "last" }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRes(page1) as Response)
      .mockResolvedValueOnce(mockRes(page2) as Response)
    const result = await fetchAllComments("owner/repo", 1, headers)
    expect(result).toHaveLength(101)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("throws on a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockRes("Not Found", false, 404) as Response)
    await expect(fetchAllComments("owner/repo", 1, headers)).rejects.toThrow("GitHub API 404")
  })
})

describe("upsertComment", () => {
  const base = { repo: "owner/repo", prNumber: 7, token: "tok", body: "<!-- coverage-report -->" }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it("POSTs a new comment when none exists", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRes([]) as Response) // fetchAllComments page 1
      .mockResolvedValueOnce(mockRes({}) as Response) // POST
    await upsertComment(base)
    const [, postCall] = vi.mocked(fetch).mock.calls
    expect((postCall![1] as RequestInit).method).toBe("POST")
    expect(postCall![0] as string).toContain(`/issues/${base.prNumber}/comments`)
  })

  it("PATCHes an existing comment when the marker is found", async () => {
    const existing = [{ id: 99, body: "<!-- coverage-report --> old content" }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRes(existing) as Response)
      .mockResolvedValueOnce(mockRes({}) as Response) // PATCH
    await upsertComment(base)
    const [, patchCall] = vi.mocked(fetch).mock.calls
    expect((patchCall![1] as RequestInit).method).toBe("PATCH")
    expect(patchCall![0] as string).toContain(`/comments/99`)
  })

  it("DELETEs stale comments before posting", async () => {
    const stale = [{ id: 55, body: "<!-- patch-coverage-report --> stale" }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRes(stale) as Response) // fetchAllComments
      .mockResolvedValueOnce(mockRes({}) as Response) // DELETE stale
      .mockResolvedValueOnce(mockRes({}) as Response) // POST new
    await upsertComment(base)
    const [, deleteCall, postCall] = vi.mocked(fetch).mock.calls
    expect((deleteCall![1] as RequestInit).method).toBe("DELETE")
    expect(deleteCall![0] as string).toContain(`/comments/55`)
    expect((postCall![1] as RequestInit).method).toBe("POST")
  })

  it("throws when the final POST/PATCH fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRes([]) as Response)
      .mockResolvedValueOnce(mockRes("Forbidden", false, 403) as Response)
    await expect(upsertComment(base)).rejects.toThrow("GitHub API 403")
  })

  it("warns but continues when a stale comment DELETE fails", async () => {
    const stale = [{ id: 55, body: "<!-- patch-coverage-report --> stale" }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRes(stale) as Response) // fetchAllComments
      .mockResolvedValueOnce(mockRes("Forbidden", false, 403) as Response) // DELETE fails
      .mockResolvedValueOnce(mockRes({}) as Response) // POST still succeeds
    await expect(upsertComment(base)).resolves.toBeUndefined()
  })
})

describe("fetchChangedFiles", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it("returns added lines keyed by filename", async () => {
    const files = [
      { status: "modified", patch: "@@ -1,1 +1,2 @@\n+new line", filename: "src/a.ts" },
    ]
    vi.mocked(fetch).mockResolvedValueOnce(mockRes(files) as Response)
    const result = await fetchChangedFiles({ repo: "owner/repo", prNumber: 1, token: "tok" })
    expect(result["src/a.ts"]).toBeDefined()
    expect(result["src/a.ts"]!.has(1)).toBe(true)
  })

  it("skips removed files", async () => {
    const files = [{ status: "removed", patch: "@@ -1,1 +0,0 @@\n-gone", filename: "src/gone.ts" }]
    vi.mocked(fetch).mockResolvedValueOnce(mockRes(files) as Response)
    const result = await fetchChangedFiles({ repo: "owner/repo", prNumber: 1, token: undefined })
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("skips files without a patch (e.g. binary files)", async () => {
    const files = [{ status: "modified", filename: "image.png" }]
    vi.mocked(fetch).mockResolvedValueOnce(mockRes(files) as Response)
    const result = await fetchChangedFiles({ repo: "owner/repo", prNumber: 1, token: undefined })
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("omits the Authorization header when no token is provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockRes([]) as Response)
    await fetchChangedFiles({ repo: "owner/repo", prNumber: 1, token: undefined })
    const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers["Authorization"]).toBeUndefined()
  })

  it("paginates through multiple pages", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      status: "modified",
      patch: "@@ -1,1 +1,1 @@\n+x",
      filename: `src/f${i}.ts`,
    }))
    const page2 = [{ status: "modified", patch: "@@ -1,1 +1,1 @@\n+x", filename: "src/last.ts" }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRes(page1) as Response)
      .mockResolvedValueOnce(mockRes(page2) as Response)
    const result = await fetchChangedFiles({ repo: "owner/repo", prNumber: 1, token: "tok" })
    expect(Object.keys(result)).toHaveLength(101)
  })

  it("throws on a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockRes("Not Found", false, 404) as Response)
    await expect(
      fetchChangedFiles({ repo: "owner/repo", prNumber: 1, token: "tok" }),
    ).rejects.toThrow("GitHub API 404")
  })
})

describe("main", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "coverage-main-test-"))
  })
  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
    delete process.env.GITHUB_EVENT_PATH
    delete process.env.COVERAGE_FINAL_PATH
  })

  it("exits early when there is no pull_request in the event", async () => {
    delete process.env.GITHUB_EVENT_PATH
    await expect(main()).resolves.toBeUndefined()
  })

  it("exits early when the event has no pull_request number", async () => {
    const eventPath = join(tmpDir, "event.json")
    writeFileSync(eventPath, JSON.stringify({ push: {} }))
    process.env.GITHUB_EVENT_PATH = eventPath
    await expect(main()).resolves.toBeUndefined()
  })

  it("exits early when coverage-final.json does not exist", async () => {
    const eventPath = join(tmpDir, "event.json")
    writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 42 } }))
    process.env.GITHUB_EVENT_PATH = eventPath
    process.env.COVERAGE_FINAL_PATH = join(tmpDir, "nonexistent.json")
    await expect(main()).resolves.toBeUndefined()
  })
})
