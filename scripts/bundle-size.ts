// Measures the client JavaScript and CSS each public page loads, from a production
// build's manifests, and fails when a page's JavaScript outgrows its budget in
// bundle-budgets.json.
//
//   pnpm bundle-size [--next-dir .next] [--update]
//
// Next 16 dropped "First Load JS" from `next build`'s output, so this reads what
// the HTML references directly: the build manifest's `rootMainFiles` (the React and
// Next runtime every page loads) plus every chunk the route's
// `page_client-reference-manifest.js` names for its layouts and page. The legacy
// polyfill chunk is left out: only browsers without ES modules fetch it. Sizes are
// gzipped, so the number tracks what readers download. Chunks a page imports lazily
// aren't counted; Lighthouse (scripts/lighthouse.ts) sees those.
//
// Budgets are kB of gzipped JavaScript per route. A page that grows past its budget
// fails the check; raise the budget in the same PR, so the growth is a reviewed line
// in the diff. `--update` rewrites the file as each route's size plus HEADROOM_KB.
//
// In CI (playwright.yml's "Bundle size" job) it reads the `.next` copied out of the
// image the PR deploys, compares with dev's last measurement (BASE_BUNDLE_SIZE_PATH),
// writes the report to the job summary and, with PR_NUMBER and GITHUB_TOKEN, to a
// PR comment.

import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import { gzipSync } from "node:zlib"
import { blue, green, red, yellow } from "./ansi.mjs"
import { prCommentTarget, upsertPrComment } from "./pr-comment"

export const BUDGETS_FILE = "bundle-budgets.json"
/** Room a budget written by `--update` leaves above the route's current size. */
export const HEADROOM_KB = 10
const COMMENT_MARKER = "bundle-size"

export interface RouteSize {
  route: string
  /** Bytes of JavaScript as served, and gzipped. */
  js: number
  jsGzip: number
  /** Bytes of CSS loaded as stylesheets (not inlined), gzipped. */
  cssGzip: number
}

export type Budgets = Record<string, number>

interface ClientReferenceManifest {
  entryJSFiles?: Record<string, string[]>
  entryCSSFiles?: Record<string, { path: string; inlined?: boolean }[]>
}

/**
 * "(frontend)/articles/[slug]/page_client-reference-manifest.js" → "/articles/[slug]".
 * Null for routes that aren't public pages: Payload's admin and Next's own error pages.
 */
export function routeFromManifestPath(path: string): string | null {
  const segments = path.split("/").slice(0, -1)
  if (segments[0] === "(payload)" || segments[0]?.startsWith("_")) return null
  return "/" + segments.filter((segment) => !/^\(.*\)$/.test(segment)).join("/")
}

/** Evaluates a client reference manifest, which assigns itself to globalThis.__RSC_MANIFEST. */
export function readClientManifest(source: string): ClientReferenceManifest {
  const context = vm.createContext({})
  vm.runInContext(source, context)
  const manifests = Object.values(
    (context.__RSC_MANIFEST ?? {}) as Record<string, ClientReferenceManifest>,
  )
  if (manifests.length !== 1) {
    throw new Error(`expected one client reference manifest, found ${manifests.length}`)
  }
  return manifests[0]!
}

function findManifests(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(`${sep}page_client-reference-manifest.js`))
    .map((file) => file.split(sep).join("/"))
    .sort()
}

export function measureRoutes(nextDir: string): RouteSize[] {
  const buildManifest = JSON.parse(readFileSync(join(nextDir, "build-manifest.json"), "utf8")) as {
    rootMainFiles: string[]
  }
  const sizes = new Map<string, { raw: number; gzip: number }>()
  const sizeOf = (file: string) => {
    let size = sizes.get(file)
    if (!size) {
      const data = readFileSync(join(nextDir, file))
      size = { raw: data.length, gzip: gzipSync(data, { level: 9 }).length }
      sizes.set(file, size)
    }
    return size
  }

  const appDir = join(nextDir, "server", "app")
  const routes: RouteSize[] = []
  for (const file of findManifests(appDir)) {
    const route = routeFromManifestPath(file)
    if (!route) continue
    const manifest = readClientManifest(readFileSync(join(appDir, file), "utf8"))
    const js = new Set([
      ...buildManifest.rootMainFiles,
      ...Object.values(manifest.entryJSFiles ?? {}).flat(),
    ])
    const css = new Set(
      Object.values(manifest.entryCSSFiles ?? {})
        .flat()
        .filter((entry) => !entry.inlined)
        .map((entry) => entry.path),
    )
    const sum = (files: Set<string>, key: "raw" | "gzip") =>
      [...files].reduce((total, f) => total + sizeOf(f)[key], 0)
    routes.push({
      route,
      js: sum(js, "raw"),
      jsGzip: sum(js, "gzip"),
      cssGzip: sum(css, "gzip"),
    })
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route))
}

const kb = (bytes: number) => bytes / 1024

export function formatKb(bytes: number): string {
  return `${kb(bytes).toFixed(1)} kB`
}

export function formatDelta(bytes: number): string {
  if (Math.abs(bytes) < 51) return "±0"
  return `${bytes > 0 ? "+" : "−"}${formatKb(Math.abs(bytes))}`
}

/** Routes whose gzipped JavaScript is over their budget. Routes without one never fail. */
export function overBudget(routes: RouteSize[], budgets: Budgets): RouteSize[] {
  return routes.filter((r) => budgets[r.route] !== undefined && kb(r.jsGzip) > budgets[r.route]!)
}

export function suggestBudgets(routes: RouteSize[]): Budgets {
  return Object.fromEntries(routes.map((r) => [r.route, Math.ceil(kb(r.jsGzip) + HEADROOM_KB)]))
}

export function renderReport({
  routes,
  base,
  budgets,
}: {
  routes: RouteSize[]
  base: RouteSize[] | null
  budgets: Budgets
}): string {
  const baseByRoute = new Map(base?.map((r) => [r.route, r]))
  const over = new Set(overBudget(routes, budgets).map((r) => r.route))
  const changed = routes.filter((r) => {
    const before = baseByRoute.get(r.route)
    return (
      !before ||
      formatDelta(r.jsGzip - before.jsGzip) !== "±0" ||
      formatDelta(r.cssGzip - before.cssGzip) !== "±0"
    )
  })

  const rows = routes.map((r) => {
    const before = baseByRoute.get(r.route)
    const budget = budgets[r.route]
    const status = over.has(r.route) ? "❌" : budget === undefined ? "➖" : "✅"
    return [
      `\`${r.route}\``,
      formatKb(r.jsGzip),
      before ? formatDelta(r.jsGzip - before.jsGzip) : base === null ? "–" : "new",
      budget === undefined ? "none" : `${status} ${budget} kB`,
      formatKb(r.cssGzip),
      before ? formatDelta(r.cssGzip - before.cssGzip) : base === null ? "–" : "new",
    ]
  })
  const table = [
    "| Route | JS (gzip) | vs dev | Budget | CSS (gzip) | vs dev |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((cells) => `| ${cells.join(" | ")} |`),
  ].join("\n")

  const lines = ["## Bundle size", ""]
  if (over.size > 0) {
    const suggested = suggestBudgets(routes.filter((r) => over.has(r.route)))
    lines.push(
      `❌ **${over.size} ${over.size === 1 ? "route is" : "routes are"} over budget.** ` +
        `Make the page lighter, or raise its budget in \`${BUDGETS_FILE}\` in this PR ` +
        `so the growth gets reviewed:`,
      "",
      "```json",
      ...Object.entries(suggested).map(([route, value]) => `"${route}": ${value},`),
      "```",
      "",
      table,
    )
  } else {
    lines.push(
      base === null
        ? "No measurement from `dev` to compare with yet. Every route is within its budget."
        : changed.length === 0
          ? "No page's client JavaScript or CSS changed size. Every route is within its budget."
          : `${changed.length} ${changed.length === 1 ? "route changed" : "routes changed"} size; ` +
            "every route is within its budget.",
      "",
      "<details><summary>Every route</summary>",
      "",
      table,
      "",
      "</details>",
    )
  }
  lines.push(
    "",
    "<sub>JavaScript and CSS a page loads before it's interactive (gzipped), from the " +
      "build's manifests. Lazily imported chunks aren't counted. `pnpm bundle-size` " +
      "measures a local build.</sub>",
  )
  return lines.join("\n")
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const nextDir = argValue(args, "--next-dir") ?? ".next"
  if (!existsSync(join(nextDir, "build-manifest.json"))) {
    console.error(`${red("✖")} No build in ${nextDir}. Run \`pnpm build\` first.`)
    return 1
  }
  const routes = measureRoutes(nextDir)
  if (routes.length === 0) {
    console.error(`${red("✖")} Found no page manifests in ${relative(".", nextDir)}/server/app.`)
    return 1
  }

  if (args.includes("--update")) {
    writeFileSync(BUDGETS_FILE, JSON.stringify(suggestBudgets(routes), null, 2) + "\n")
    console.warn(`${green("✔")} Wrote ${BUDGETS_FILE}: each route's size + ${HEADROOM_KB} kB.`)
    return 0
  }

  const budgets = existsSync(BUDGETS_FILE)
    ? (JSON.parse(readFileSync(BUDGETS_FILE, "utf8")) as Budgets)
    : {}
  const basePath = process.env.BASE_BUNDLE_SIZE_PATH
  const base =
    basePath && existsSync(basePath)
      ? (JSON.parse(readFileSync(basePath, "utf8")) as RouteSize[])
      : null

  const out = process.env.BUNDLE_SIZE_OUT
  if (out) writeFileSync(out, JSON.stringify(routes, null, 2) + "\n")

  for (const r of routes) {
    const budget = budgets[r.route]
    const mark = budget !== undefined && kb(r.jsGzip) > budget ? red("✖") : blue("●")
    console.warn(
      `${mark} ${r.route.padEnd(28)} JS ${formatKb(r.jsGzip).padStart(9)} gzip` +
        `${budget === undefined ? yellow("  (no budget)") : `  / ${budget} kB`}` +
        `   CSS ${formatKb(r.cssGzip)}`,
    )
  }

  const report = renderReport({ routes, base, budgets })
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

  const over = overBudget(routes, budgets)
  if (over.length > 0) {
    console.error(
      `${red("✖")} Over budget: ${over.map((r) => r.route).join(", ")}. ` +
        `Make the page lighter, or raise its budget in ${BUDGETS_FILE}.`,
    )
    return 1
  }
  return 0
}

// Only run when invoked directly, so the helpers above can be unit-tested.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main()
}
