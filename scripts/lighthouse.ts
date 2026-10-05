// Runs Lighthouse's performance audit on a set of seeded pages, for this build and,
// when one is running beside it, for dev's, and reports how each page moved. It only
// ever warns; scripts/bundle-size.ts is the gate, on byte counts that don't vary.
//
//   pnpm lighthouse                          seed, build and serve, then audit
//   SERVER_URL=http://localhost:8000 \
//     pnpm exec tsx scripts/lighthouse.ts    audit a server already running the
//                                            E2E seed (scripts/seed-e2e.ts)
//
// Lighthouse's timings come from the work Chrome did on this machine's CPU, slowed
// down to imitate a phone, so they move with the machine. Four things keep that out
// of the comparison:
//
//   - Dev on the same machine. With BASE_SERVER_URL (dev's image, which CI starts
//     beside this one) every page is audited on both, alternating which goes first,
//     so whatever the runner does to one side it does to the other.
//   - Spreads, not single numbers. Each side gets LIGHTHOUSE_RUNS runs (default 5),
//     and a metric is flagged only when every run of this build is worse than every
//     run of dev's, and the medians differ by more than THRESHOLDS.
//   - A calibrated CPU slowdown. Lighthouse scores the CPU with a benchmark
//     (benchmarkIndex); the slowdown is scaled by it so a faster runner is slowed
//     more, putting runs on different machines on the same footing.
//     LIGHTHOUSE_CPU_MULTIPLIER overrides it.
//   - Nothing off the machine. Chrome resolves every host but localhost to nothing,
//     so a third-party script (Turnstile, analytics) fails at once instead of taking
//     however long the internet takes.
//
// Results go to lighthouse-results/: summary.json and each page's median report as
// HTML (`.dev.html` for dev's). CHROME_PATH picks the browser; by default it's
// Playwright's Chromium. In CI (playwright.yml's "Lighthouse" job) the report goes to
// the job summary and, with PR_NUMBER and GITHUB_TOKEN, to a PR comment; regressions
// also become warning annotations.

import { chromium } from "@playwright/test"
import { launch } from "chrome-launcher"
import lighthouse from "lighthouse"
import type { Flags, Result as LighthouseResult } from "lighthouse"
import { throttling } from "lighthouse/core/config/constants.js"
import { computeMedianRun, filterToValidRuns } from "lighthouse/core/lib/median-run.js"
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
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

/**
 * The benchmark index that gets Lighthouse's default 4× CPU slowdown: roughly what the
 * machine these thresholds were set on scored (1999–2204). A runner scoring twice that
 * is slowed 8×.
 */
export const REFERENCE_BENCHMARK_INDEX = 2000
const DEFAULT_CPU_MULTIPLIER = throttling.mobileSlow4G.cpuSlowdownMultiplier

export const METRICS = [
  "score",
  "fcp",
  "lcp",
  "tbt",
  "cls",
  "speedIndex",
  "totalBytes",
  "scriptBytes",
] as const
export type Metric = (typeof METRICS)[number]
export type Samples = Record<Metric, number[]>

export interface PageResult {
  name: string
  path: string
  /** Every run of this build, and of dev's (null without a dev server, or if it failed). */
  pr: Samples
  dev: Samples | null
}

export interface Summary {
  runs: number
  benchmarkIndex: number
  cpuSlowdownMultiplier: number
  pages: PageResult[]
}

/**
 * How far apart the medians must also be before a metric is flagged, relative and
 * absolute, so a 30 ms page doesn't warn for going to 40 ms. Byte counts don't vary
 * between runs, so for them this alone decides.
 */
export const THRESHOLDS: Record<Metric, { relative: number; absolute: number }> = {
  score: { relative: 0, absolute: 3 },
  fcp: { relative: 0.05, absolute: 100 },
  lcp: { relative: 0.05, absolute: 100 },
  tbt: { relative: 0.1, absolute: 50 },
  cls: { relative: 0, absolute: 0.02 },
  speedIndex: { relative: 0.05, absolute: 100 },
  totalBytes: { relative: 0.02, absolute: 10 * 1024 },
  scriptBytes: { relative: 0.02, absolute: 5 * 1024 },
}

export function metricsOf(lhr: LighthouseResult): Record<Metric, number> {
  const numeric = (id: string) => lhr.audits[id]?.numericValue ?? Number.NaN
  const resources = (
    lhr.audits["resource-summary"]?.details as
      { items?: { resourceType: string; transferSize: number }[] } | undefined
  )?.items
  return {
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

export function samplesOf(lhrs: LighthouseResult[]): Samples {
  const all = lhrs.map(metricsOf)
  return Object.fromEntries(METRICS.map((m) => [m, all.map((run) => run[m])])) as Samples
}

export function median(values: number[]): number {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return Number.NaN
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Lighthouse's CPU slowdown for a machine with this benchmark index. */
export function cpuMultiplier(benchmarkIndex: number): number {
  if (!Number.isFinite(benchmarkIndex) || benchmarkIndex <= 0) return DEFAULT_CPU_MULTIPLIER
  const scaled = (DEFAULT_CPU_MULTIPLIER * benchmarkIndex) / REFERENCE_BENCHMARK_INDEX
  return Math.min(20, Math.max(1, Math.round(scaled * 10) / 10))
}

/**
 * Whether `metric` is worse on this build than on dev's: every run worse than every
 * run of dev's, and the medians further apart than its threshold.
 */
export function regressed(metric: Metric, dev: number[], pr: number[]): boolean {
  if (dev.length === 0 || pr.length === 0) return false
  // A lower score is worse; for everything else, higher is.
  const higherIsWorse = metric !== "score"
  const worseBy = (after: number, before: number) =>
    higherIsWorse ? after - before : before - after
  const best = higherIsWorse ? Math.min(...pr) : Math.max(...pr)
  const worst = higherIsWorse ? Math.max(...dev) : Math.min(...dev)
  const before = median(dev)
  const change = worseBy(median(pr), before)
  const { relative, absolute } = THRESHOLDS[metric]
  return worseBy(best, worst) > 0 && change > absolute && change > Math.abs(before) * relative
}

export function regressions(page: PageResult): Metric[] {
  const dev = page.dev
  if (!dev) return []
  return METRICS.filter((m) => regressed(m, dev[m], page.pr[m]))
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

export function formatRange(metric: Metric, values: number[]): string {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return "n/a"
  const low = formatValue(metric, Math.min(...finite))
  const high = formatValue(metric, Math.max(...finite))
  return low === high ? low : `${low}–${high}`
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

export function renderReport(summary: Summary): string {
  const { pages, runs } = summary
  const compared = pages.filter((p) => p.dev)
  let flagged = 0
  const rows = pages.map((page) => {
    const worse = new Set(regressions(page))
    if (worse.size > 0) flagged++
    const cells = COLUMNS.map(({ metric }) => {
      const after = median(page.pr[metric])
      const value = formatValue(metric, after)
      const change = page.dev ? formatChange(metric, median(page.dev[metric]), after) : ""
      return worse.has(metric) ? `⚠️ **${value}**${change}` : `${value}${change}`
    })
    return `| ${page.name} | ${cells.join(" | ")} |`
  })
  const table = [
    `| Page | ${COLUMNS.map((c) => c.label).join(" | ")} |`,
    `| --- | ${COLUMNS.map(() => "---:").join(" | ")} |`,
    ...rows,
  ].join("\n")

  const spreads = [
    `| Page | | ${COLUMNS.map((c) => c.label).join(" | ")} |`,
    `| --- | --- | ${COLUMNS.map(() => "---:").join(" | ")} |`,
    ...pages.flatMap((page) => [
      `| ${page.name} | this PR | ${COLUMNS.map(({ metric }) => formatRange(metric, page.pr[metric])).join(" | ")} |`,
      ...(page.dev
        ? [
            `| | dev | ${COLUMNS.map(({ metric }) => formatRange(metric, page.dev![metric])).join(" | ")} |`,
          ]
        : []),
    ]),
  ].join("\n")

  const headline =
    compared.length === 0
      ? "Dev's image wasn't available to compare with, so these are this PR's numbers alone."
      : flagged === 0
        ? "No page is slower than on `dev`: wherever the medians differ, the runs overlap."
        : `⚠️ ${flagged} ${flagged === 1 ? "page is" : "pages are"} slower than on \`dev\` ` +
          `in every one of ${runs} runs. The full reports are in the \`lighthouse-results\` ` +
          "artifact."
  const missing = pages.length - compared.length
  return [
    "## Lighthouse",
    "",
    headline,
    ...(compared.length > 0 && missing > 0
      ? ["", `Dev's image couldn't serve ${missing} of the pages, so those aren't compared.`]
      : []),
    "",
    table,
    "",
    "<details><summary>Every run's range</summary>",
    "",
    spreads,
    "",
    "</details>",
    "",
    `<sub>Medians of ${runs} runs per page, Lighthouse's mobile settings with simulated ` +
      `throttling (CPU ${summary.cpuSlowdownMultiplier}× slower, from a benchmark index of ` +
      `${Math.round(summary.benchmarkIndex)}). Changes are against dev's image, audited ` +
      "on the same runner in alternating runs. A metric is flagged only when every run is " +
      "worse than every dev run. This never fails the build.</sub>",
  ].join("\n")
}

interface Side {
  label: "pr" | "dev"
  server: string
  runs: { lhr: LighthouseResult; html: string }[]
  failed: boolean
}

async function audit(
  url: string,
  flags: Flags,
  html: boolean,
): Promise<{ lhr: LighthouseResult; html: string }> {
  const result = await lighthouse(url, html ? { ...flags, output: "html" } : flags)
  if (!result) throw new Error(`Lighthouse returned nothing for ${url}`)
  if (result.lhr.runtimeError) throw new Error(`${url}: ${result.lhr.runtimeError.message}`)
  return { lhr: result.lhr, html: html ? (result.report as string) : "" }
}

function medianOf(runs: Side["runs"]): Side["runs"][number] | undefined {
  const valid = filterToValidRuns(runs.map((r) => r.lhr))
  if (valid.length === 0) return undefined
  const best = computeMedianRun(valid)
  return runs.find((r) => r.lhr === best)
}

export async function main(): Promise<number> {
  const server = process.env.SERVER_URL || "http://localhost:8000"
  const baseServer = process.env.BASE_SERVER_URL
  const runs = Number(process.env.LIGHTHOUSE_RUNS) || 5
  const chromePath = process.env.CHROME_PATH || chromium.executablePath()
  mkdirSync(OUT_DIR, { recursive: true })

  const chrome = await launch({
    chromePath,
    chromeFlags: [
      "--headless=new",
      // CI runs this as root inside the Playwright container.
      "--no-sandbox",
      "--disable-dev-shm-usage",
      // Every host but the servers under test fails to resolve, at once.
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost",
    ],
  })
  const baseFlags: Flags = {
    port: chrome.port,
    logLevel: "error",
    onlyCategories: ["performance"],
    throttlingMethod: "simulate",
  }

  let summary: Summary
  try {
    // Calibrate on the home page, which doubles as its warm-up.
    const homeUrl = new URL("/", server).toString()
    const calibration: number[] = []
    for (let i = 0; i < 3; i++) {
      calibration.push((await audit(homeUrl, baseFlags, false)).lhr.environment.benchmarkIndex)
    }
    const benchmarkIndex = median(calibration)
    const multiplier =
      Number(process.env.LIGHTHOUSE_CPU_MULTIPLIER) || cpuMultiplier(benchmarkIndex)
    console.warn(
      `${blue("●")} Benchmark index ${Math.round(benchmarkIndex)} → CPU slowdown ${multiplier}×`,
    )
    const flags: Flags = {
      ...baseFlags,
      throttling: { ...throttling.mobileSlow4G, cpuSlowdownMultiplier: multiplier },
    }

    const pages: PageResult[] = []
    for (const page of PAGES) {
      const sides: Side[] = [
        { label: "pr", server, runs: [], failed: false },
        ...(baseServer
          ? [{ label: "dev" as const, server: baseServer, runs: [], failed: false }]
          : []),
      ]
      console.warn(`${blue("●")} Auditing ${page.name} (${page.path})...`)
      const run = async (side: Side, keep: boolean) => {
        if (side.failed) return
        try {
          const result = await audit(new URL(page.path, side.server).toString(), flags, keep)
          if (keep) side.runs.push(result)
        } catch (err) {
          // This build failing is an error; dev's image failing (say, on a page this PR
          // adds) leaves the page uncompared.
          if (side.label === "pr") throw err
          console.warn(`${yellow("⚠")} Dev's image: ${(err as Error).message}`)
          side.failed = true
        }
      }
      // Warm-up: the first request renders the page and optimizes its images.
      for (const side of sides) await run(side, false)
      for (let i = 0; i < runs; i++) {
        for (const side of i % 2 ? [...sides].reverse() : sides) await run(side, true)
      }

      const [pr, dev] = sides
      const result: PageResult = {
        name: page.name,
        path: page.path,
        pr: samplesOf(pr!.runs.map((r) => r.lhr)),
        dev: dev && !dev.failed ? samplesOf(dev.runs.map((r) => r.lhr)) : null,
      }
      pages.push(result)
      const file = page.path === "/" ? "home" : page.path.slice(1).replaceAll("/", "-")
      for (const side of sides) {
        const best = medianOf(side.runs)
        if (best) {
          const suffix = side.label === "dev" ? ".dev" : ""
          writeFileSync(join(OUT_DIR, `${file}${suffix}.html`), best.html)
        }
      }
      const worse = regressions(result)
      console.warn(
        `${worse.length ? yellow("⚠") : green("✔")} ${page.name}: ` +
          `LCP ${formatRange("lcp", result.pr.lcp)}, TBT ${formatRange("tbt", result.pr.tbt)}` +
          (result.dev
            ? ` (dev: LCP ${formatRange("lcp", result.dev.lcp)}, TBT ${formatRange("tbt", result.dev.tbt)})`
            : ""),
      )
      if (worse.length > 0 && process.env.GITHUB_ACTIONS) {
        const detail = worse
          .map(
            (m) =>
              `${m} ${formatValue(m, median(result.dev![m]))} → ${formatValue(m, median(result.pr[m]))}`,
          )
          .join(", ")
        console.warn(`::warning title=Lighthouse: ${page.name}::${detail}`)
      }
    }
    summary = { runs, benchmarkIndex, cpuSlowdownMultiplier: multiplier, pages }
  } catch (err) {
    console.error(`${red("✖")} ${(err as Error).message}`)
    return 1
  } finally {
    chrome.kill()
  }
  writeFileSync(join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2) + "\n")

  const report = renderReport(summary)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n")
  }
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
