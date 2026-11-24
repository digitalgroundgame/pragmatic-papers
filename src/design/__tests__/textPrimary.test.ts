import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(dirname, "../..")

/** Every source file under `src/`, tests and the design guide's own pages left out. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "design" ? [] : sourceFiles(full)
    }
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : []
  })
}

/** `text-primary` as a class (any variant prefix), but not `text-primary-foreground`. */
const TEXT_PRIMARY = /(?<![\w-])text-primary(?![\w-])/
/** A Typography (prose) color that reads the primary token. */
const PROSE_PRIMARY = /--tw-prose-[\w-]+:\s*var\(--color-primary\)/

function offenders(pattern: RegExp): string[] {
  return sourceFiles(src).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) =>
        pattern.test(line) ? [`${path.relative(src, file)}:${i + 1}: ${line.trim()}`] : [],
      ),
  )
}

describe("primary is a fill, never a text color", () => {
  it("no class sets text in text-primary", () => {
    expect(offenders(TEXT_PRIMARY)).toEqual([])
  })

  it("no prose color reads the primary token", () => {
    expect(offenders(PROSE_PRIMARY)).toEqual([])
  })

  it("the patterns catch what they should, and leave the label token alone", () => {
    expect(TEXT_PRIMARY.test('link: "text-primary underline"')).toBe(true)
    expect(TEXT_PRIMARY.test("[&>a:hover]:text-primary text-sm")).toBe(true)
    expect(TEXT_PRIMARY.test("bg-primary text-primary-foreground")).toBe(false)
    expect(TEXT_PRIMARY.test("text-primary/80")).toBe(true)
    expect(PROSE_PRIMARY.test("--tw-prose-code: var(--color-primary);")).toBe(true)
  })
})
