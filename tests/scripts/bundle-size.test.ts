import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { gzipSync } from "node:zlib"

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"

import type * as PrComment from "../../scripts/pr-comment"

vi.mock("../../scripts/pr-comment", async (importOriginal) => ({
  ...(await importOriginal<typeof PrComment>()),
  upsertPrCommentSection: vi.fn(),
}))

import { upsertPrCommentSection } from "../../scripts/pr-comment"

import {
  formatDelta,
  jumps,
  main,
  measureRoutes,
  readClientManifest,
  renderReport,
  renderSummary,
  routeFromManifestPath,
  type RouteSize,
} from "../../scripts/bundle-size"

const manifestSource = (
  key: string,
  js: Record<string, string[]>,
  css: Record<string, { path: string; inlined: boolean }[]> = {},
) =>
  `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n` +
  `globalThis.__RSC_MANIFEST[${JSON.stringify(key)}] = ${JSON.stringify({
    moduleLoading: { prefix: "" },
    entryJSFiles: js,
    entryCSSFiles: css,
  })};\n`

describe("routeFromManifestPath", () => {
  it("drops route groups and the file name", () => {
    expect(routeFromManifestPath("(frontend)/page_client-reference-manifest.js")).toBe("/")
    expect(
      routeFromManifestPath("(frontend)/articles/[slug]/page_client-reference-manifest.js"),
    ).toBe("/articles/[slug]")
    expect(
      routeFromManifestPath("feed/[collection]/[slug]/page_client-reference-manifest.js"),
    ).toBe("/feed/[collection]/[slug]")
  })

  it("skips Payload's admin and Next's own error pages", () => {
    expect(
      routeFromManifestPath("(payload)/admin/[[...segments]]/page_client-reference-manifest.js"),
    ).toBeNull()
    expect(routeFromManifestPath("_not-found/page_client-reference-manifest.js")).toBeNull()
    expect(routeFromManifestPath("_global-error/page_client-reference-manifest.js")).toBeNull()
  })
})

describe("readClientManifest", () => {
  it("evaluates the manifest without touching this process's globals", () => {
    const manifest = readClientManifest(manifestSource("/(frontend)/page", { a: ["x.js"] }))
    expect(manifest.entryJSFiles).toEqual({ a: ["x.js"] })
    expect((globalThis as { __RSC_MANIFEST?: unknown }).__RSC_MANIFEST).toBeUndefined()
  })
})

const gz = (contents: string) => gzipSync(contents, { level: 9 }).length

const RUNTIME = "runtime();".repeat(50)
const LAYOUT = "layout();".repeat(40)
const ARTICLE = "article();".repeat(30)
const STYLES = "body{color:red}".repeat(20)

/**
 * A `.next` with two public pages (the home page and articles) sharing a runtime and a
 * layout chunk, plus Payload's admin, which isn't measured.
 */
function writeBuild(nextDir: string): void {
  const write = (path: string, contents: string) => {
    mkdirSync(dirname(join(nextDir, path)), { recursive: true })
    writeFileSync(join(nextDir, path), contents)
  }
  write(
    "build-manifest.json",
    JSON.stringify({
      polyfillFiles: ["static/chunks/polyfill.js"],
      rootMainFiles: ["static/chunks/runtime.js"],
    }),
  )
  write("static/chunks/polyfill.js", "polyfill();".repeat(500))
  write("static/chunks/runtime.js", RUNTIME)
  write("static/chunks/layout.js", LAYOUT)
  write("static/chunks/article.js", ARTICLE)
  write("static/chunks/styles.css", STYLES)
  write("static/chunks/inline.css", "inlined{}".repeat(100))
  write(
    "server/app/(frontend)/page_client-reference-manifest.js",
    manifestSource("/(frontend)/page", {
      "[project]/src/app/(frontend)/layout": ["static/chunks/layout.js"],
      "[project]/src/app/(frontend)/page": ["static/chunks/layout.js"],
    }),
  )
  write(
    "server/app/(frontend)/articles/[slug]/page_client-reference-manifest.js",
    manifestSource(
      "/(frontend)/articles/[slug]/page",
      {
        "[project]/src/app/(frontend)/layout": ["static/chunks/layout.js"],
        "[project]/src/app/(frontend)/articles/[slug]/page": [
          "static/chunks/layout.js",
          "static/chunks/article.js",
        ],
      },
      {
        "[project]/src/app/(frontend)/layout": [
          { path: "static/chunks/styles.css", inlined: false },
          { path: "static/chunks/inline.css", inlined: true },
        ],
      },
    ),
  )
  write(
    "server/app/(payload)/admin/[[...segments]]/page_client-reference-manifest.js",
    manifestSource("/(payload)/admin/[[...segments]]/page", { admin: ["static/chunks/x.js"] }),
  )
}

describe("measureRoutes", () => {
  let nextDir: string

  beforeEach(() => {
    nextDir = mkdtempSync(join(tmpdir(), "bundle-size-"))
    writeBuild(nextDir)
  })

  afterEach(() => rmSync(nextDir, { recursive: true, force: true }))

  it("adds each route's chunks to the shared runtime, counting each chunk once", () => {
    expect(measureRoutes(nextDir)).toEqual([
      {
        route: "/",
        js: RUNTIME.length + LAYOUT.length,
        jsGzip: gz(RUNTIME) + gz(LAYOUT),
        cssGzip: 0,
      },
      {
        route: "/articles/[slug]",
        js: RUNTIME.length + LAYOUT.length + ARTICLE.length,
        jsGzip: gz(RUNTIME) + gz(LAYOUT) + gz(ARTICLE),
        cssGzip: gz(STYLES),
      },
    ])
  })
})

const route = (name: string, jsKb: number, cssKb = 10): RouteSize => ({
  route: name,
  js: jsKb * 4096,
  jsGzip: jsKb * 1024,
  cssGzip: cssKb * 1024,
})

describe("jumps", () => {
  it("flags only routes whose JavaScript grew by more than 10 kB vs dev", () => {
    const routes = [route("/", 110), route("/search", 110.5), route("/smaller", 50)]
    const base = [route("/", 100), route("/search", 100), route("/smaller", 100)]
    expect(jumps(routes, base).map((r) => r.route)).toEqual(["/search"])
  })

  it("never flags a route dev doesn't have, or anything without a measurement from dev", () => {
    expect(jumps([route("/new", 900)], [route("/", 100)])).toEqual([])
    expect(jumps([route("/", 900)], null)).toEqual([])
  })
})

describe("formatDelta", () => {
  it("rounds changes under 50 bytes to nothing", () => {
    expect(formatDelta(50)).toBe("±0")
    expect(formatDelta(2048)).toBe("+2.0 kB")
    expect(formatDelta(-1536)).toBe("−1.5 kB")
  })
})

describe("renderReport", () => {
  it("collapses the table when nothing changed", () => {
    const report = renderReport({ routes: [route("/", 100)], base: [route("/", 100)] })
    expect(report).toContain("No page's client JavaScript or CSS changed size.")
    expect(report).toContain("<details>")
    expect(report).toContain("| `/` | 100.0 kB | ±0 | 10.0 kB | ±0 |")
  })

  it("counts the routes that changed", () => {
    const report = renderReport({
      routes: [route("/", 104), route("/search", 100)],
      base: [route("/", 100), route("/search", 100)],
    })
    expect(report).toContain("1 route changed size; none grew by more than 10 kB.")
    expect(report).toContain("| `/` | 104.0 kB | +4.0 kB |")
  })

  it("leads with the routes that jumped, and shows the whole table", () => {
    const report = renderReport({
      routes: [route("/", 130), route("/search", 100)],
      base: [route("/", 100), route("/search", 100)],
    })
    expect(report).toContain("⚠ **1 route grew by more than 10 kB vs dev.**")
    expect(report).toContain("| `/` | 130.0 kB | ⚠ +30.0 kB |")
    expect(report).toContain("| `/search` | 100.0 kB | ±0 |")
    expect(report).not.toContain("<details>")
  })

  it("marks routes dev didn't have", () => {
    const report = renderReport({ routes: [route("/", 100)], base: [] })
    expect(report).toContain("| `/` | 100.0 kB | new |")
  })

  it("says when there's no measurement from dev", () => {
    expect(renderReport({ routes: [route("/", 100)], base: null })).toContain(
      "No measurement from `dev` to compare with yet.",
    )
  })
})

describe("renderSummary", () => {
  it("leads with the routes that jumped", () => {
    expect(
      renderSummary({
        routes: [route("/", 130), route("/search", 120)],
        base: [route("/", 100), route("/search", 100)],
      }),
    ).toBe("⚠ 2 routes grew by more than 10 kB")
  })

  it("counts the routes that changed, or says nothing did", () => {
    expect(renderSummary({ routes: [route("/", 104)], base: [route("/", 100)] })).toBe(
      "1 route changed size, none by more than 10 kB",
    )
    expect(renderSummary({ routes: [route("/", 100)], base: [route("/", 100)] })).toBe("no change")
  })

  it("says when there's no measurement from dev", () => {
    expect(renderSummary({ routes: [route("/", 100)], base: null })).toBe(
      "no measurement from dev to compare with yet",
    )
  })
})

describe("main", () => {
  const cwd = process.cwd()
  let dir: string
  let warn: MockInstance<typeof console.warn>
  let error: MockInstance<typeof console.error>
  /** Dev's measurement: this build's, with each route's JavaScript `kbLess` kB smaller. */
  const devMeasured = async (kbLess: Record<string, number>) => {
    vi.stubEnv("BUNDLE_SIZE_OUT", join(dir, "now.json"))
    await main([])
    const now = JSON.parse(readFileSync(join(dir, "now.json"), "utf8")) as RouteSize[]
    const base = now.map((r) => ({ ...r, jsGzip: r.jsGzip - (kbLess[r.route] ?? 0) * 1024 }))
    writeFileSync(join(dir, "base.json"), JSON.stringify(base))
    vi.stubEnv("BASE_BUNDLE_SIZE_PATH", join(dir, "base.json"))
    vi.stubEnv("BUNDLE_SIZE_OUT", "")
  }

  beforeEach(() => {
    // The build is read from the working directory's .next. Each test file runs in its
    // own process, so moving it is safe.
    dir = mkdtempSync(join(tmpdir(), "bundle-size-main-"))
    writeBuild(join(dir, ".next"))
    process.chdir(dir)
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("BASE_BUNDLE_SIZE_PATH", "")
    vi.stubEnv("BUNDLE_SIZE_OUT", "")
    vi.stubEnv("GITHUB_STEP_SUMMARY", "")
    vi.stubEnv("PR_NUMBER", "")
    vi.stubEnv("GITHUB_ACTIONS", "")
  })

  afterEach(() => {
    process.chdir(cwd)
    rmSync(dir, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.mocked(upsertPrCommentSection).mockReset()
  })

  it("fails without a build to measure", async () => {
    expect(await main(["--next-dir", "missing"])).toBe(1)
    expect(error.mock.calls[0]![0]).toContain("No build in missing")
  })

  it("fails on a build with no public pages", async () => {
    rmSync(join(dir, ".next/server"), { recursive: true })
    expect(await main([])).toBe(1)
    expect(error.mock.calls[0]![0]).toContain("Found no page manifests")
  })

  const annotations = () =>
    warn.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith("::"))

  it("passes, and annotates nothing, when no route jumped", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "true")
    await devMeasured({ "/": 5 })
    warn.mockClear()
    expect(await main([])).toBe(0)
    expect(error).not.toHaveBeenCalled()
    expect(annotations()).toEqual([])
  })

  it("only warns, with an annotation naming the route, when one jumped", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "true")
    await devMeasured({ "/articles/[slug]": 12 })
    warn.mockClear()

    expect(await main([])).toBe(0)
    expect(annotations()).toEqual([
      "::warning title=Bundle size::/articles/[slug] grew by 12.0 kB of gzipped JavaScript vs dev",
    ])
    expect(warn.mock.calls.some(([line]) => String(line).includes("+12.0 kB vs dev"))).toBe(true)
  })

  it("saves the measurement and the report for CI, comparing with dev's", async () => {
    const base: RouteSize[] = [{ route: "/", js: 0, jsGzip: 0, cssGzip: 0 }]
    writeFileSync(join(dir, "base.json"), JSON.stringify(base))
    vi.stubEnv("BASE_BUNDLE_SIZE_PATH", join(dir, "base.json"))
    vi.stubEnv("BUNDLE_SIZE_OUT", join(dir, "out.json"))
    vi.stubEnv("GITHUB_STEP_SUMMARY", join(dir, "summary.md"))

    expect(await main([])).toBe(0)

    const saved = JSON.parse(readFileSync(join(dir, "out.json"), "utf8")) as RouteSize[]
    expect(saved.map((r) => r.route)).toEqual(["/", "/articles/[slug]"])
    const summary = readFileSync(join(dir, "summary.md"), "utf8")
    expect(summary).toContain("## Bundle size")
    // The article route is new to dev; the home page has a change against it.
    expect(summary).toMatch(/\| `\/articles\/\[slug\]` \| [\d.]+ kB \| new \|/)
  })

  it("posts the report on the PR, and keeps going if GitHub refuses it", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "owner/repo")
    vi.stubEnv("GITHUB_TOKEN", "t0ken")
    vi.stubEnv("PR_NUMBER", "7")
    vi.mocked(upsertPrCommentSection).mockRejectedValueOnce(new Error("GitHub API 403"))

    expect(await main([])).toBe(0)
    expect(upsertPrCommentSection).toHaveBeenCalledWith(
      { repo: "owner/repo", prNumber: 7, token: "t0ken" },
      "bundle-size",
      expect.stringContaining("<details><summary><strong>Bundle size</strong>: no measurement"),
      { staleMarkers: ["<!-- bundle-size -->"] },
    )
    expect(warn.mock.calls.some(([line]) => String(line).includes("GitHub API 403"))).toBe(true)
  })
})
