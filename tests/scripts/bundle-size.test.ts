import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { gzipSync } from "node:zlib"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  formatDelta,
  measureRoutes,
  overBudget,
  readClientManifest,
  renderReport,
  routeFromManifestPath,
  suggestBudgets,
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

describe("measureRoutes", () => {
  let nextDir: string
  const write = (path: string, contents: string) => {
    mkdirSync(dirname(join(nextDir, path)), { recursive: true })
    writeFileSync(join(nextDir, path), contents)
  }
  const gz = (contents: string) => gzipSync(contents, { level: 9 }).length

  const RUNTIME = "runtime();".repeat(50)
  const LAYOUT = "layout();".repeat(40)
  const ARTICLE = "article();".repeat(30)
  const STYLES = "body{color:red}".repeat(20)

  beforeEach(() => {
    nextDir = mkdtempSync(join(tmpdir(), "bundle-size-"))
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

describe("budgets", () => {
  it("fails only routes over their budget, never routes without one", () => {
    const routes = [route("/", 100), route("/search", 120.5), route("/new", 900)]
    expect(overBudget(routes, { "/": 100, "/search": 120 }).map((r) => r.route)).toEqual([
      "/search",
    ])
  })

  it("suggests each route's size plus the headroom, rounded up", () => {
    expect(suggestBudgets([route("/", 100.2)])).toEqual({ "/": 111 })
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
  it("collapses the table when everything is within budget", () => {
    const report = renderReport({
      routes: [route("/", 100)],
      base: [route("/", 100)],
      budgets: { "/": 110 },
    })
    expect(report).toContain("No page's client JavaScript or CSS changed size.")
    expect(report).toContain("<details>")
    expect(report).toContain("| `/` | 100.0 kB | ±0 | ✅ 110 kB | 10.0 kB | ±0 |")
  })

  it("counts the routes that changed", () => {
    const report = renderReport({
      routes: [route("/", 104), route("/search", 100)],
      base: [route("/", 100), route("/search", 100)],
      budgets: {},
    })
    expect(report).toContain("1 route changed size")
    expect(report).toContain("| `/` | 104.0 kB | +4.0 kB | none |")
  })

  it("names the budgets to raise when a route is over", () => {
    const report = renderReport({
      routes: [route("/", 130), route("/search", 100)],
      base: [route("/", 100), route("/search", 100)],
      budgets: { "/": 110, "/search": 110 },
    })
    expect(report).toContain("❌ **1 route is over budget.**")
    expect(report).toContain('"/": 140,')
    expect(report).not.toContain('"/search"')
    expect(report).not.toContain("<details>")
  })

  it("marks routes dev didn't have", () => {
    const report = renderReport({ routes: [route("/", 100)], base: [], budgets: {} })
    expect(report).toContain("| `/` | 100.0 kB | new |")
  })
})
