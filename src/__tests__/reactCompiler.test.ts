/**
 * The React Compiler (`reactCompiler` in next.config.ts) memoizes components and hooks, so they
 * don't use useMemo or useCallback. It leaves a component it can't compile as written, without
 * saying so in the build. These tests run it over `src/` and check:
 *
 * - which components it skips, so a new one is a choice: rewrite it (usually by moving a
 *   `try`/`finally` out of the component, or into `.finally()`), or add it to `SKIPPED`
 * - that no compiled component still memoizes by hand
 */
import { transformAsync } from "@babel/core"
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(import.meta.dirname, "../..")

/**
 * Components and hooks the compiler can't compile yet, by file, with what stops it. They run
 * as written, so their own useMemo and useCallback calls stay. Remove a file once it compiles.
 */
const SKIPPED: Record<string, string> = {
  "src/blocks/Form/FormBlockClient.tsx": "`?.` inside try/catch",
  "src/blocks/InteractiveMap/download/MapDownload.tsx": "try/finally, dynamic import()",
  "src/blocks/NewsletterSignup/Component.client.tsx": "`?.` inside try/catch",
  "src/collections/Articles/components/CloneFromProduction/Client.tsx":
    "throw inside try, for await",
  "src/collections/Articles/components/ExtractNarrationButton.tsx": "try/finally",
  "src/collections/InteractiveSnapshots/components/SyncNowButton.tsx": "try/finally",
  "src/collections/Media/components/BlurDataURLField.tsx": "try with no catch",
  "src/collections/Media/components/Unsplash/UnsplashSearch.tsx": "try/finally",
  "src/collections/Merch/components/SyncNowButton.tsx": "try/finally",
  "src/collections/Volumes/components/ScheduleNewsletterButton.tsx": "try/finally",
  "src/components/Account/LinkedSignIns.tsx": "try/finally",
  "src/components/Account/index.tsx": "try/finally, throw inside try",
  "src/components/BeforeDashboard/SeedButton/index.tsx": "try/finally, for await",
  "src/components/Comments/CommentForm.tsx": "try/finally",
  "src/components/Comments/index.tsx": "throw inside try",
  "src/components/Pagination/index.tsx": "an arrow function in a reordered expression",
  "src/globals/ArticleRecommendations/components/RunNowField.tsx": "try/finally",
  "src/interactives/engine/DrilldownSearch.tsx": "try/finally",
  "src/interactives/federal-courts/Charts.tsx": "`++` on a variable a callback captures",
  "src/plugins/sso/components/LinkedAccounts.tsx": "try/finally",
  "src/plugins/sso/components/SignInButtons.tsx": "throw inside try",
  "src/plugins/tours/TourProvider.tsx": "dynamic import()",
}

/**
 * Where hand memoization stays in compiled code: shadcn's components, copied from upstream
 * and kept matching it so a later `shadcn add` merges cleanly.
 */
const HAND_MEMOIZED = ["src/components/ui/"]

interface Span {
  start: number
  end: number
}

interface FileReport {
  file: string
  compiled: Span[]
  skipped: Span[]
  /** Lines of the file's useMemo and useCallback calls. */
  memoLines: number[]
}

const MEMO_CALL = /\b(?:React\.)?(?:useMemo|useCallback)\s*(?:<[^>(]*>)?\s*\(/g

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

async function compile(file: string): Promise<FileReport> {
  const source = await readFile(path.join(root, file), "utf8")
  const report: FileReport = { file, compiled: [], skipped: [], memoLines: [] }
  for (const match of source.matchAll(MEMO_CALL)) {
    report.memoLines.push(lineOf(source, match.index))
  }
  await transformAsync(source, {
    filename: file,
    babelrc: false,
    configFile: false,
    code: false,
    presets: [["@babel/preset-typescript", { isTSX: true, allExtensions: true }]],
    plugins: [
      [
        "babel-plugin-react-compiler",
        {
          panicThreshold: "none",
          logger: {
            logEvent(_filename: string | null, event: Record<string, unknown>) {
              const loc = event.fnLoc as { start: { line: number }; end: { line: number } } | null
              if (!loc) return
              const span = { start: loc.start.line, end: loc.end.line }
              if (event.kind === "CompileSuccess") report.compiled.push(span)
              else if (event.kind === "CompileError") report.skipped.push(span)
            },
          },
        },
      ],
    ],
  })
  return report
}

/** The innermost compiled or skipped function around `line`, if any. */
function enclosing(report: FileReport, line: number): "compiled" | "skipped" | null {
  const around = (spans: Span[]) => spans.filter((s) => s.start <= line && line <= s.end)
  const all = [
    ...around(report.compiled).map((s) => ({ ...s, kind: "compiled" as const })),
    ...around(report.skipped).map((s) => ({ ...s, kind: "skipped" as const })),
  ].sort((a, b) => b.start - a.start)
  return all[0]?.kind ?? null
}

const files = execFileSync("git", ["ls-files", "src/**/*.ts", "src/**/*.tsx"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter(
    (f) =>
      f && !/(__tests__|\.test\.|\.stories\.|^src\/migrations\/|^src\/payload-types\.ts$)/.test(f),
  )

const reports = Promise.all(files.map(compile))

describe("React Compiler", () => {
  it("skips only the components listed in SKIPPED", async () => {
    const skipped = (await reports).filter((r) => r.skipped.length > 0).map((r) => r.file)
    expect(skipped.sort()).toEqual(Object.keys(SKIPPED).sort())
  }, 120_000)

  it("leaves no hand memoization in a compiled component", async () => {
    const leftover = (await reports).flatMap((r) =>
      HAND_MEMOIZED.some((dir) => r.file.startsWith(dir))
        ? []
        : r.memoLines
            .filter((line) => enclosing(r, line) === "compiled")
            .map((l) => `${r.file}:${l}`),
    )
    expect(leftover).toEqual([])
  }, 120_000)
})
