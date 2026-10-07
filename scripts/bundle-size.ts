// Measures the client JavaScript and CSS each public page loads, from a production
// build's manifests, and flags a page whose JavaScript grew by more than JUMP_KB
// against dev's last measurement.
//
//   pnpm bundle-size [--next-dir .next]
//
// Next 16 dropped "First Load JS" from `next build`'s output, so this reads what
// the HTML references directly: the build manifest's `rootMainFiles` (the React and
// Next runtime every page loads) plus every chunk the route's
// `page_client-reference-manifest.js` names for its layouts and page. The legacy
// polyfill chunk is left out: only browsers without ES modules fetch it. Sizes are
// gzipped, so the number tracks what readers download. Chunks a page imports lazily
// aren't counted; Lighthouse (scripts/lighthouse.ts) sees those.
//
// Pages are expected to grow over time, so there are no fixed budgets: a jump of more
// than JUMP_KB in one PR is what gets flagged, and it only warns.
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
import { blue, red, yellow } from "./ansi.mjs"
import { prCommentTarget, upsertPrComment } from "./pr-comment"

/** Growth in a route's gzipped JavaScript against dev, in kB, that gets flagged. */
export const JUMP_KB = 10
const COMMENT_MARKER = "bundle-size"

export interface RouteSize {
  route: string
  /** Bytes of JavaScript as served, and gzipped. */
  js: number
  jsGzip: number
  /** Bytes of CSS loaded as stylesheets (not inlined), gzipped. */
  cssGzip: number
}

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

/**
 * Routes whose gzipped JavaScript grew by more than JUMP_KB against dev. A route dev
 * doesn't have isn't flagged: there's nothing to compare it with.
 */
export function jumps(routes: RouteSize[], base: RouteSize[] | null): RouteSize[] {
  const baseByRoute = new Map(base?.map((r) => [r.route, r]))
  return routes.filter((r) => {
    const before = baseByRoute.get(r.route)
    return before !== undefined && kb(r.jsGzip - before.jsGzip) > JUMP_KB
  })
}

export function renderReport({
  routes,
  base,
}: {
  routes: RouteSize[]
  base: RouteSize[] | null
}): string {
  const baseByRoute = new Map(base?.map((r) => [r.route, r]))
  const jumped = new Set(jumps(routes, base).map((r) => r.route))
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
    const vsDev = before ? formatDelta(r.jsGzip - before.jsGzip) : base === null ? "–" : "new"
    return [
      `\`${r.route}\``,
      formatKb(r.jsGzip),
      jumped.has(r.route) ? `⚠ ${vsDev}` : vsDev,
      formatKb(r.cssGzip),
      before ? formatDelta(r.cssGzip - before.cssGzip) : base === null ? "–" : "new",
    ]
  })
  const table = [
    "| Route | JS (gzip) | vs dev | CSS (gzip) | vs dev |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows.map((cells) => `| ${cells.join(" | ")} |`),
  ].join("\n")

  const lines = ["## Bundle size", ""]
  if (jumped.size > 0) {
    lines.push(
      `⚠ **${jumped.size} ${jumped.size === 1 ? "route" : "routes"} grew by more than ` +
        `${JUMP_KB} kB vs dev.** Check that the growth is meant: \`pnpm analyze\` shows ` +
        "which import brings a module in.",
      "",
      table,
    )
  } else {
    lines.push(
      base === null
        ? "No measurement from `dev` to compare with yet."
        : changed.length === 0
          ? "No page's client JavaScript or CSS changed size."
          : `${changed.length} ${changed.length === 1 ? "route changed" : "routes changed"} size; ` +
            `none grew by more than ${JUMP_KB} kB.`,
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

  const basePath = process.env.BASE_BUNDLE_SIZE_PATH
  const base =
    basePath && existsSync(basePath)
      ? (JSON.parse(readFileSync(basePath, "utf8")) as RouteSize[])
      : null

  const out = process.env.BUNDLE_SIZE_OUT
  if (out) writeFileSync(out, JSON.stringify(routes, null, 2) + "\n")

  const jumped = new Set(jumps(routes, base).map((r) => r.route))
  const baseByRoute = new Map(base?.map((r) => [r.route, r]))
  for (const r of routes) {
    const before = baseByRoute.get(r.route)
    const vsDev = before ? `  ${formatDelta(r.jsGzip - before.jsGzip)} vs dev` : ""
    console.warn(
      `${jumped.has(r.route) ? yellow("⚠") : blue("●")} ${r.route.padEnd(28)} ` +
        `JS ${formatKb(r.jsGzip).padStart(9)} gzip${vsDev}   CSS ${formatKb(r.cssGzip)}`,
    )
  }

  const report = renderReport({ routes, base })
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

  // A GitHub annotation per route, so a jump shows on the PR's checks; it never fails.
  if (process.env.GITHUB_ACTIONS) {
    for (const r of routes.filter((route) => jumped.has(route.route))) {
      const before = baseByRoute.get(r.route)!
      console.warn(
        `::warning title=Bundle size::${r.route} grew by ` +
          `${formatKb(r.jsGzip - before.jsGzip)} of gzipped JavaScript vs dev`,
      )
    }
  }
  return 0
}

// Only run when invoked directly, so the helpers above can be unit-tested.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main()
}
