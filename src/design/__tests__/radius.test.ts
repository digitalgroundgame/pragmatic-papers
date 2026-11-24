import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { RADII } from "../tokens"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(dirname, "../..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

/** The radii the design guide allows, by size: `sm`, `xs` and `full`. */
const ALLOWED = new Set(RADII.map((radius) => radius.utility.replace("rounded-", "")))
/** Sizes that pass anyway: no rounding, and a child copying its parent's. */
const NEUTRAL = new Set(["none", "[inherit]"])
/** Corners kept on purpose, file by file. */
const EXCEPTIONS: Record<string, string[]> = {
  // The reading feed's phone frame is drawn like a device.
  "app/feed/FeedShell.tsx": ["md:rounded-3xl"],
}

/**
 * Every `rounded-…` class in a string: an optional side (`t`, `bl`, …), then a size. A bare
 * `rounded` (4px) only counts inside a class string, beside another class, so prose that says
 * "rounded" doesn't.
 */
const CLASS =
  /(?<=^|[\s"'`])((?:[^\s"'`]*:)?)rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?(?:-(\w+|\[[^\]\s]+\]))?(?=$|[\s"'`])/g

function radiiIn(source: string): { token: string; size: string }[] {
  return [...source.matchAll(CLASS)].flatMap((match) => {
    const token = match[0]
    const size = match[2] ?? ""
    if (size) return [{ token, size }]
    // A bare `rounded`: only when it sits in a class list.
    const line = source.slice(
      source.lastIndexOf("\n", match.index) + 1,
      source.indexOf("\n", match.index),
    )
    return /["'`][^"'`]*\b[\w:-]+-[\w-]+\s+rounded\s|["'`]rounded\s+[\w-]+-/.test(line)
      ? [{ token, size }]
      : []
  })
}

describe("corner radius", () => {
  it("the guide allows rounded-sm, rounded-xs and rounded-full", () => {
    expect([...ALLOWED].sort()).toEqual(["full", "sm", "xs"])
  })

  it("the parser reads sides, variants and arbitrary values", () => {
    expect(radiiIn('"p-2 rounded-lg border"')).toEqual([{ token: "rounded-lg", size: "lg" }])
    expect(radiiIn('"md:rounded-t-xl"')).toEqual([{ token: "md:rounded-t-xl", size: "xl" }])
    expect(radiiIn('"x rounded-[min(var(--radius-md),10px)]"')).toEqual([
      { token: "rounded-[min(var(--radius-md),10px)]", size: "[min(var(--radius-md),10px)]" },
    ])
    expect(radiiIn('"bg-card rounded px-2"')).toEqual([{ token: "rounded", size: "" }])
    expect(radiiIn("// coordinates are rounded to a grid")).toEqual([])
  })

  it("every class uses an allowed radius", () => {
    const offenders = sourceFiles(src).flatMap((file) => {
      const relative = path.relative(src, file).split(path.sep).join("/")
      const kept = EXCEPTIONS[relative] ?? []
      return radiiIn(readFileSync(file, "utf8"))
        .filter(
          ({ token, size }) => !ALLOWED.has(size) && !NEUTRAL.has(size) && !kept.includes(token),
        )
        .map(({ token }) => `${relative}: ${token}`)
    })
    expect(offenders).toEqual([])
  })
})
