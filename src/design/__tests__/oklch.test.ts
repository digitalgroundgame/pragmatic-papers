import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { LIGHT_COLORS } from "@/interactives/whip-count/picture"

import { parseThemes } from "../cssTokens"
import { formatOklch, hexToOklch, oklchToHex, parseOklch } from "../oklch"

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

describe("oklch conversions", () => {
  it("round-trips sRGB hex through OKLCH", () => {
    for (const hex of ["#ff401a", "#126ace", "#d81334", "#ffffff", "#000000", "#e5e5e5"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
      expect(oklchToHex(parseOklch(formatOklch(hex))!)).toBe(hex)
    }
  })

  it("reads percentages and alpha", () => {
    expect(parseOklch("oklch(45% 0.1 200 / 50%)")).toEqual({ l: 0.45, c: 0.1, h: 200, alpha: 0.5 })
    expect(parseOklch("#fff")).toBeNull()
  })

  it("matches the brand color the guide fixes", () => {
    expect(tokenHex("brand")).toBe("#ff401a")
  })
})

describe("theme colors are oklch", () => {
  it("globals.css sets every color token in oklch, in both themes", () => {
    const notOklch = (["light", "dark"] as const).flatMap((theme) =>
      Object.entries(themes[theme])
        .filter(([, value]) => /^(#|rgb|hsl)/.test(value))
        .map(([name, value]) => `${theme} --${name}: ${value}`),
    )
    expect(notOklch).toEqual([])
  })

  it("the hex noted beside each data-palette step is that step's color", () => {
    const noted = [
      ...globalsCss.matchAll(/--(map-[\w-]+):\s*(oklch\([^)]*\));\s*\/\*\s*(#[0-9a-f]{6})/g),
    ]
    expect(noted).toHaveLength(8)
    for (const [, name, , hex] of noted) expect(tokenHex(name!)).toBe(hex)
  })

  it("every `var(--map-…, #hex)` fallback is its token's color", () => {
    const fallbacks = sourceFiles(src).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/var\(--(map-[\w-]+),\s*(#[0-9a-fA-F]{6})\)/g)].map(
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
