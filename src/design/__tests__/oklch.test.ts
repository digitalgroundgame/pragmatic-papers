import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { LIGHT_COLORS } from "@/interactives/whip-count/picture"

import { parseThemes } from "../cssTokens"
import { oklchToHex, parseOklch } from "./oklchToHex"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(dirname, "../..")
const globalsCss = readFileSync(path.join(src, "app/(frontend)/globals.css"), "utf8")
const themes = parseThemes(globalsCss)

/** A light-theme token as the nearest hex. */
function tokenHex(name: string): string {
  const value = themes.light[name]
  const parsed = value ? parseOklch(value) : null
  if (!parsed) throw new Error(`--${name} is not an oklch() color: ${value}`)
  return oklchToHex(parsed)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full)
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : []
  })
}

describe("oklchToHex", () => {
  it("converts known colors", () => {
    expect(oklchToHex(parseOklch("oklch(0.6567 0.2311 32.7)")!)).toBe("#ff401a")
    expect(oklchToHex(parseOklch("oklch(1 0 0)")!)).toBe("#ffffff")
    expect(oklchToHex(parseOklch("oklch(45.316% 0.00005 271.152)")!)).toBe("#565656")
    expect(parseOklch("oklch(1 0 0 / 10%)")).toEqual({ l: 1, c: 0, h: 0 })
    expect(parseOklch("#fff")).toBeNull()
  })
})

describe("hex copies of theme colors", () => {
  it("the hex noted beside each data-palette step is that step's color", () => {
    const noted = [
      ...globalsCss.matchAll(/--(chart-[\w-]+):\s*(oklch\([^)]*\));\s*\/\*\s*(#[0-9a-f]{6})/g),
    ]
    expect(noted).toHaveLength(8)
    for (const [, name, , hex] of noted) expect(tokenHex(name!)).toBe(hex)
  })

  it("every `var(--chart-…, #hex)` fallback is its token's color", () => {
    const fallbacks = sourceFiles(src).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/var\(--(chart-[\w-]+),\s*(#[0-9a-fA-F]{6})\)/g)].map(
        ([, name, hex]) => ({
          where: `${path.relative(src, file)} --${name}`,
          name: name!,
          hex: hex!,
        }),
      ),
    )
    expect(fallbacks.length).toBeGreaterThan(0)
    const drifted = fallbacks
      .filter(({ name, hex }) => tokenHex(name) !== hex.toLowerCase())
      .map(({ where, hex }) => `${where}: ${hex}`)
    expect(drifted).toEqual([])
  })

  it("the whip count picture's hex copies are the light theme's tokens", () => {
    const drifted = Object.entries(LIGHT_COLORS)
      .map(([variable, hex]) => ({ name: /var\(--([\w-]+)\)/.exec(variable)![1]!, hex }))
      .filter(({ name, hex }) => tokenHex(name) !== hex)
      .map(({ name, hex }) => `--${name}: ${hex}, token is ${tokenHex(name)}`)
    expect(drifted).toEqual([])
  })
})
