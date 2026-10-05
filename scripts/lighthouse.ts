// Runs Lighthouse's performance audit on a set of seeded pages and reports how each
// moved against dev. It only ever warns: timings on a shared CI runner vary between
// identical runs, so a regression here is a prompt to look, not a verdict. Byte
// counts don't vary that way; scripts/bundle-size.ts gates on those.
//
//   pnpm lighthouse                          seed, build and serve, then audit
//   SERVER_URL=http://localhost:8000 \
//     pnpm exec tsx scripts/lighthouse.ts    audit a server already running the
//                                            E2E seed (scripts/seed-e2e.ts)
//
// Each page is loaded once to warm the server's caches, then audited
// LIGHTHOUSE_RUNS times (default 3) with Lighthouse's default mobile settings and
// simulated throttling; the run Lighthouse picks as the median is the one reported.
// Results go to lighthouse-results/: summary.json, read back as dev's baseline, and
// each page's median report as HTML. CHROME_PATH picks the browser; by default it's
// Playwright's Chromium.
//
// In CI (playwright.yml's "Lighthouse" job) it compares with dev's last summary
// (BASE_LIGHTHOUSE_PATH), writes the report to the job summary and, with PR_NUMBER
// and GITHUB_TOKEN, to a PR comment. Regressions also become warning annotations.

import { chromium } from "@playwright/test"
import { launch } from "chrome-launcher"
import lighthouse from "lighthouse"
import type { Result as LighthouseResult } from "lighthouse"
import { computeMedianRun, filterToValidRuns } from "lighthouse/core/lib/median-run.js"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { blue, green, red, yellow } from "./ansi.mjs"
import { prCommentTarget, upsertPrComment } from "./pr-comment"
import { CODE_BLOCKS_SLUG, FOOTNOTES_SLUG, SHOWCASE_SLUG, VOLUME_SLUG } from "./seed-e2e.constants"

export const PAGES = [
  { name: "Home", path: "/" },
  { name: "Article: rich text", path: `/articles/${SHOWCASE_SLUG}` },
  { name: "Article: footnotes", path: `/articles/${FOOTNOTES_SLUG}` },
  { name: "Article: code blocks", path: `/articles/${CODE_BLOCKS_SLUG}` },
  {
    name: "Article: interactive map",
    path: "/articles/missouri-shifting-margins-119-120-congressional-maps",
  },
  { name: "Volume", path: `/volumes/${VOLUME_SLUG}` },
  { name: "Interactive page", path: "/interactives/federal-courts" },
]

const OUT_DIR = "lighthouse-results"
const COMMENT_MARKER = "lighthouse"

export interface PageResult {
  name: string
  path: string
  /** 0–100. */
  score: number
  fcp: number
  lcp: number
  tbt: number
  cls: number
  speedIndex: number
  /** Bytes transferred: everything, and scripts alone. */
  totalBytes: number
  scriptBytes: number
}

type Metric = Exclude<keyof PageResult, "name" | "path">

/**
 * When a metric counts as worse than dev's: it must move past both a relative and an
 * absolute floor, so a 30 ms page doesn't warn for going to 40 ms. The timing floors
 * sit above what two audits of the same build differed by (TBT by ~130 ms, LCP by
 * ~800 ms on one page); byte counts didn't differ at all.
 */
export const THRESHOLDS: Record<Metric, { relative: number; absolute: number }> = {
  score: { relative: 0, absolute: 10 },
  fcp: { relative: 0.25, absolute: 500 },
  lcp: { relative: 0.25, absolute: 500 },
  tbt: { relative: 0.5, absolute: 200 },
  cls: { relative: 0, absolute: 0.05 },
  speedIndex: { relative: 0.25, absolute: 500 },
  totalBytes: { relative: 0.1, absolute: 50 * 1024 },
  scriptBytes: { relative: 0.05, absolute: 10 * 1024 },
}

export function summarize(name: string, path: string, lhr: LighthouseResult): PageResult {
  const numeric = (id: string) => lhr.audits[id]?.numericValue ?? Number.NaN
  const resources = (
    lhr.audits["resource-summary"]?.details as
      { items?: { resourceType: string; transferSize: number }[] } | undefined
  )?.items
  return {
    name,
    path,
    score: Math.round((lhr.categories.performance?.score ?? 0) * 100),
    fcp: numeric("first-contentful-paint"),
    lcp: numeric("largest-contentful-paint"),
    tbt: numeric("total-blocking-time"),
    cls: numeric("cumulative-layout-shift"),
    speedIndex: numeric("speed-index"),
    totalBytes: numeric("total-byte-weight"),
    scriptBytes: resources?.find((item) => item.resourceType === "script")?.transferSize ?? 0,
  }
}

/** Whether `metric` got worse from `before` to `after` by more than its threshold. */
export function regressed(metric: Metric, before: number, after: number): boolean {
  const { relative, absolute } = THRESHOLDS[metric]
  // A lower score is worse; for everything else, higher is.
  const change = metric === "score" ? before - after : after - before
  return change > absolute && change > Math.abs(before) * relative
}

export function regressions(result: PageResult, base: PageResult | undefined): Metric[] {
  if (!base) return []
  return (Object.keys(THRESHOLDS) as Metric[]).filter((metric) =>
    regressed(metric, base[metric], result[metric]),
  )
}

export function formatValue(metric: Metric, value: number): string {
  if (!Number.isFinite(value)) return "n/a"
  if (metric === "score") return String(Math.round(value))
  if (metric === "cls") return value.toFixed(3)
  if (metric === "totalBytes" || metric === "scriptBytes") return `${(value / 1024).toFixed(0)} kB`
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`
}

function formatChange(metric: Metric, before: number, after: number): string {
  const delta = after - before
  if (!Number.isFinite(delta)) return ""
  const shown = formatValue(metric, Math.abs(delta))
  if (/^0(\.0+)?( |$)/.test(shown)) return ""
  return ` (${delta > 0 ? "+" : "−"}${shown})`
}

const COLUMNS: { metric: Metric; label: string }[] = [
  { metric: "score", label: "Score" },
  { metric: "lcp", label: "LCP" },
  { metric: "tbt", label: "TBT" },
  { metric: "cls", label: "CLS" },
  { metric: "fcp", label: "FCP" },
  { metric: "scriptBytes", label: "JS" },
  { metric: "totalBytes", label: "Total" },
]

export function renderReport({
  results,
  base,
  runs,
}: {
  results: PageResult[]
  base: PageResult[] | null
  runs: number
}): string {
  const baseByPath = new Map(base?.map((r) => [r.path, r]))
  let flagged = 0
  const rows = results.map((result) => {
    const before = baseByPath.get(result.path)
    const worse = new Set(regressions(result, before))
    if (worse.size > 0) flagged++
    const cells = COLUMNS.map(({ metric }) => {
      const value = formatValue(metric, result[metric])
      const change = before ? formatChange(metric, before[metric], result[metric]) : ""
      return worse.has(metric) ? `⚠️ **${value}**${change}` : `${value}${change}`
    })
    return `| ${result.name} | ${cells.join(" | ")} |`
  })
  const table = [
    `| Page | ${COLUMNS.map((c) => c.label).join(" | ")} |`,
    `| --- | ${COLUMNS.map(() => "---:").join(" | ")} |`,
    ...rows,
  ].join("\n")

  const headline =
    base === null
      ? "No results from `dev` to compare with yet."
      : flagged === 0
        ? "No page moved past the noise thresholds compared with `dev`."
        : `⚠️ ${flagged} ${flagged === 1 ? "page looks" : "pages look"} slower than on \`dev\`. ` +
          "Runner timings are noisy, so check the full reports (the `lighthouse-results` " +
          "artifact) before acting, or re-run the job."
  return [
    "## Lighthouse",
    "",
    headline,
    "",
    table,
    "",
    `<sub>Median of ${runs} runs per page on the seeded E2E database, Lighthouse's mobile ` +
      "settings with simulated throttling. Changes are against `dev`'s last run. This never " +
      "fails the build: timings vary between runs on a CI runner.</sub>",
  ].join("\n")
}

async function auditPage(
  url: string,
  port: number,
  runs: number,
): Promise<{ lhr: LighthouseResult; html: string }> {
  const flags = { port, logLevel: "error" as const, onlyCategories: ["performance"] }
  // Warm-up: the first request renders the page and optimizes its images server-side.
  await lighthouse(url, flags)
  const results: { lhr: LighthouseResult; html: string }[] = []
  for (let i = 0; i < runs; i++) {
    const result = await lighthouse(url, { ...flags, output: "html" })
    if (!result) throw new Error(`Lighthouse returned nothing for ${url}`)
    if (result.lhr.runtimeError) {
      console.warn(`${yellow("⚠")} ${url}: ${result.lhr.runtimeError.message}`)
    }
    results.push({ lhr: result.lhr, html: result.report as string })
  }
  const valid = filterToValidRuns(results.map((r) => r.lhr))
  if (valid.length === 0) throw new Error(`every Lighthouse run of ${url} failed`)
  const median = computeMedianRun(valid)
  return results.find((r) => r.lhr === median)!
}

export async function main(): Promise<number> {
  const server = process.env.SERVER_URL || "http://localhost:8000"
  const runs = Number(process.env.LIGHTHOUSE_RUNS) || 3
  const chromePath = process.env.CHROME_PATH || chromium.executablePath()
  mkdirSync(OUT_DIR, { recursive: true })

  // --no-sandbox: CI runs this as root inside the Playwright container.
  const chrome = await launch({
    chromePath,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
  })
  const results: PageResult[] = []
  try {
    for (const page of PAGES) {
      const url = new URL(page.path, server).toString()
      console.warn(`${blue("●")} Auditing ${page.name} (${url})...`)
      const { lhr, html } = await auditPage(url, chrome.port, runs)
      const result = summarize(page.name, page.path, lhr)
      results.push(result)
      const file = page.path === "/" ? "home" : page.path.slice(1).replaceAll("/", "-")
      writeFileSync(join(OUT_DIR, `${file}.html`), html)
      console.warn(
        `${green("✔")} ${page.name}: score ${result.score}, ` +
          `LCP ${formatValue("lcp", result.lcp)}, TBT ${formatValue("tbt", result.tbt)}`,
      )
    }
  } catch (err) {
    console.error(`${red("✖")} ${(err as Error).message}`)
    return 1
  } finally {
    chrome.kill()
  }
  writeFileSync(join(OUT_DIR, "summary.json"), JSON.stringify(results, null, 2) + "\n")

  const basePath = process.env.BASE_LIGHTHOUSE_PATH
  const base =
    basePath && existsSync(basePath)
      ? (JSON.parse(readFileSync(basePath, "utf8")) as PageResult[])
      : null
  const baseByPath = new Map(base?.map((r) => [r.path, r]))
  for (const result of results) {
    const worse = regressions(result, baseByPath.get(result.path))
    if (worse.length > 0 && process.env.GITHUB_ACTIONS) {
      const before = baseByPath.get(result.path)!
      const detail = worse
        .map((m) => `${m} ${formatValue(m, before[m])} → ${formatValue(m, result[m])}`)
        .join(", ")
      console.warn(`::warning title=Lighthouse: ${result.name}::${detail}`)
    }
  }

  const report = renderReport({ results, base, runs })
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n")
  const target = prCommentTarget()
  if (target) {
    try {
      await upsertPrComment(target, COMMENT_MARKER, report)
    } catch (err) {
      console.warn(`${yellow("⚠")} Could not post the PR comment: ${(err as Error).message}`)
    }
  }
  return 0
}

// Only run when invoked directly, so the helpers above can be unit-tested.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main()
}
