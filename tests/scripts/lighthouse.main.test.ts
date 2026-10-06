import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as PrComment from "../../scripts/pr-comment"

const { audits, chrome } = vi.hoisted(() => ({
  /** Every Lighthouse run main() asked for, in order. */
  audits: [] as { url: string; flags: Record<string, unknown> }[],
  chrome: { port: 9222, kill: vi.fn() },
}))

vi.mock("@playwright/test", () => ({ chromium: { executablePath: () => "/playwright/chrome" } }))
vi.mock("chrome-launcher", () => ({ launch: vi.fn(async () => chrome) }))
vi.mock("lighthouse", () => ({ default: vi.fn() }))
vi.mock("../../scripts/pr-comment", async (importOriginal) => ({
  ...(await importOriginal<typeof PrComment>()),
  upsertPrComment: vi.fn(),
}))

import { launch } from "chrome-launcher"
import lighthouse from "lighthouse"

import { main, METRICS, PAGES, type Samples, type Summary } from "../../scripts/lighthouse"
import { upsertPrComment } from "../../scripts/pr-comment"

const PR = "http://localhost:8000"

interface Fake {
  lcp?: number
  benchmarkIndex?: number
  runtimeError?: string
}

/**
 * Answers each run like Lighthouse would, from `fakes(url)`. Byte counts are fixed; LCP
 * is whatever the fake says, so a test can make one side slower.
 */
function answerWith(fakes: (url: string) => Fake = () => ({})): void {
  vi.mocked(lighthouse).mockImplementation((async (url: string, flags: Record<string, unknown>) => {
    audits.push({ url, flags })
    const fake = fakes(url)
    const audit = (numericValue: number) => ({ numericValue })
    return {
      report: `<html>${url}</html>`,
      lhr: {
        runtimeError: fake.runtimeError ? { message: fake.runtimeError } : undefined,
        environment: { benchmarkIndex: fake.benchmarkIndex ?? 2000 },
        categories: { performance: { score: 0.9 } },
        audits: {
          "first-contentful-paint": audit(1000),
          interactive: audit(3000),
          "largest-contentful-paint": audit(fake.lcp ?? 2000),
          "total-blocking-time": audit(100),
          "cumulative-layout-shift": audit(0),
          "speed-index": audit(1500),
          "total-byte-weight": audit(500_000),
          "resource-summary": {
            details: { items: [{ resourceType: "script", transferSize: 300_000 }] },
          },
        },
      },
    }
  }) as never)
}

const runsOf = (path: string) => audits.filter((a) => a.url === new URL(path, PR).toString())

/** A summary.json as a push to dev writes it: every page at the fakes' defaults. */
function devSummary(pages = PAGES): Summary {
  const defaults: Record<string, number> = {
    score: 90,
    fcp: 1000,
    lcp: 2000,
    tbt: 100,
    cls: 0,
    speedIndex: 1500,
    totalBytes: 500_000,
    scriptBytes: 300_000,
  }
  const samples = Object.fromEntries(
    METRICS.map((m) => [m, [defaults[m]!, defaults[m]!]]),
  ) as Samples
  return {
    runs: 2,
    benchmarkIndex: 2000,
    cpuSlowdownMultiplier: 4,
    pages: pages.map(({ name, path }) => ({ name, path, pr: samples, dev: null })),
  }
}

describe("main", () => {
  const cwd = process.cwd()
  let dir: string

  beforeEach(() => {
    // Results go to ./lighthouse-results. Each test file runs in its own process.
    dir = mkdtempSync(join(tmpdir(), "lighthouse-main-"))
    process.chdir(dir)
    audits.length = 0
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("SERVER_URL", PR)
    writeFileSync(join(dir, "dev-summary.json"), JSON.stringify(devSummary()))
    vi.stubEnv("BASE_LIGHTHOUSE_PATH", join(dir, "dev-summary.json"))
    vi.stubEnv("LIGHTHOUSE_RUNS", "2")
    vi.stubEnv("LIGHTHOUSE_CPU_MULTIPLIER", "")
    vi.stubEnv("CHROME_PATH", "")
    vi.stubEnv("GITHUB_ACTIONS", "")
    vi.stubEnv("GITHUB_STEP_SUMMARY", "")
    vi.stubEnv("PR_NUMBER", "")
    answerWith()
  })

  afterEach(() => {
    process.chdir(cwd)
    rmSync(dir, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    chrome.kill.mockClear()
    vi.mocked(launch).mockClear()
    vi.mocked(upsertPrComment).mockReset()
  })

  const summary = () =>
    JSON.parse(readFileSync(join(dir, "lighthouse-results/summary.json"), "utf8")) as Summary

  it("launches Chrome where it can only reach localhost, and closes it", async () => {
    expect(await main()).toBe(0)
    expect(launch).toHaveBeenCalledWith({
      chromePath: "/playwright/chrome",
      chromeFlags: expect.arrayContaining([
        "--headless=new",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost",
      ]),
    })
    expect(chrome.kill).toHaveBeenCalledTimes(1)
  })

  it("scales the CPU slowdown by the median of three benchmarks of the home page", async () => {
    let calibrating = 0
    answerWith(() => ({ benchmarkIndex: [2000, 3000, 9000][calibrating++] ?? 2000 }))
    await main()

    expect(audits.slice(0, 3).map((a) => a.url)).toEqual(Array(3).fill(`${PR}/`))
    expect(audits[3]!.flags.throttling).toMatchObject({ cpuSlowdownMultiplier: 6 })
    expect(summary()).toMatchObject({ benchmarkIndex: 3000, cpuSlowdownMultiplier: 6 })
  })

  it("takes LIGHTHOUSE_CPU_MULTIPLIER over the benchmark", async () => {
    vi.stubEnv("LIGHTHOUSE_CPU_MULTIPLIER", "3.5")
    await main()
    expect(audits.at(-1)!.flags.throttling).toMatchObject({ cpuSlowdownMultiplier: 3.5 })
  })

  it("warms each page up, then keeps a report of each run", async () => {
    await main()
    // Warm-ups render no report; the kept runs do.
    const outputs = runsOf(PAGES[1]!.path).map((a) => a.flags.output)
    expect(outputs).toEqual([undefined, "html", "html"])
  })

  it("compares every page with dev's last results, and writes the median report", async () => {
    expect(await main()).toBe(0)
    const { pages, runs } = summary()
    expect(runs).toBe(2)
    expect(pages.map((p) => p.path)).toEqual(PAGES.map((p) => p.path))
    expect(pages.every((p) => p.pr.lcp.length === 2 && p.dev?.lcp.length === 2)).toBe(true)
    expect(readFileSync(join(dir, "lighthouse-results/home.html"), "utf8")).toBe(
      `<html>${PR}/</html>`,
    )
  })

  it.each([
    ["no results from dev", ""],
    ["dev's results missing", "missing.json"],
    ["dev's results unreadable", "broken.json"],
  ])("audits this build alone with %s", async (_, file) => {
    writeFileSync(join(dir, "broken.json"), "{")
    vi.stubEnv("BASE_LIGHTHOUSE_PATH", file && join(dir, file))
    expect(await main()).toBe(0)
    expect(summary().pages.every((p) => p.dev === null)).toBe(true)
  })

  it("leaves a page dev's results don't have uncompared", async () => {
    const page = PAGES[2]!
    writeFileSync(
      join(dir, "dev-summary.json"),
      JSON.stringify(devSummary(PAGES.filter((p) => p !== page))),
    )
    expect(await main()).toBe(0)
    const pages = summary().pages
    expect(pages.find((p) => p.path === page.path)!.dev).toBeNull()
    expect(pages.filter((p) => p.dev !== null)).toHaveLength(PAGES.length - 1)
  })

  it("fails, and still closes Chrome, when this build can't be audited", async () => {
    answerWith((url) =>
      url.startsWith(PR) && url.endsWith("/volumes/1") ? { runtimeError: "500" } : {},
    )
    expect(await main()).toBe(1)
    expect(chrome.kill).toHaveBeenCalledTimes(1)
    expect(existsSync(join(dir, "lighthouse-results/summary.json"))).toBe(false)
  })

  it("annotates a regression in CI and posts the report on the PR", async () => {
    const page = PAGES[0]!.path
    answerWith((url) => (url === `${PR}${page}` ? { lcp: 4000 } : {}))
    vi.stubEnv("GITHUB_ACTIONS", "true")
    vi.stubEnv("GITHUB_STEP_SUMMARY", join(dir, "step-summary.md"))
    vi.stubEnv("GITHUB_REPOSITORY", "owner/repo")
    vi.stubEnv("GITHUB_TOKEN", "t0ken")
    vi.stubEnv("PR_NUMBER", "7")

    expect(await main()).toBe(0)

    const annotations = vi
      .mocked(console.warn)
      .mock.calls.map(([line]) => String(line))
      .filter((line) => line.startsWith("::warning"))
    expect(annotations).toEqual(["::warning title=Lighthouse: Home::lcp 2.0 s → 4.0 s"])
    expect(readFileSync(join(dir, "step-summary.md"), "utf8")).toContain("⚠️ 1 page is much slower")
    expect(upsertPrComment).toHaveBeenCalledWith(
      { repo: "owner/repo", prNumber: 7, token: "t0ken" },
      "lighthouse",
      expect.stringContaining("## Lighthouse"),
    )
  })

  it("keeps its result when GitHub refuses the comment", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "owner/repo")
    vi.stubEnv("GITHUB_TOKEN", "t0ken")
    vi.stubEnv("PR_NUMBER", "7")
    vi.mocked(upsertPrComment).mockRejectedValueOnce(new Error("GitHub API 403"))
    expect(await main()).toBe(0)
    expect(vi.mocked(console.warn).mock.calls.some(([l]) => String(l).includes("403"))).toBe(true)
  })
})
