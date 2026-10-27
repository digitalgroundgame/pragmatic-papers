import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeAll, describe, expect, it, vi } from "vitest"

interface LocalFontOptions {
  src: string | { path: string; weight?: string; style?: string }[]
  variable: string
  adjustFontFallback?: false | string
  fallback?: string[]
}

const calls: LocalFontOptions[] = []
vi.mock("next/font/local", () => ({
  default: (options: LocalFontOptions) => {
    calls.push(options)
    return { variable: `__variable${options.variable}` }
  },
}))

const dir = path.resolve(__dirname, "..")
const sans = (): LocalFontOptions => calls.find((call) => call.variable === "--font-sans")!

describe("fonts", () => {
  beforeAll(async () => {
    await import("../fonts")
  })

  it("never fetches a font from Google at build time", () => {
    expect(readFileSync(path.join(dir, "fonts.ts"), "utf8")).not.toMatch(
      /from "next\/font\/google"/,
    )
  })

  it("serves Geist from the repo at the weights the site uses", () => {
    const { src } = sans()
    expect(Array.isArray(src) && src.map(({ weight }) => weight)).toEqual(["400", "600"])
    for (const face of src as { path: string }[]) {
      const file = readFileSync(path.join(dir, face.path))
      expect(file.subarray(0, 4).toString("latin1")).toBe("wOF2")
    }
  })

  it("keeps Geist's own fallback faces instead of generating Arial metrics", () => {
    expect(sans().adjustFontFallback).toBe(false)
    expect(sans().fallback?.slice(0, 2)).toEqual(["Geist Fallback Arial", "Geist Fallback Roboto"])
  })

  it("ships Geist's license beside the font", () => {
    expect(readFileSync(path.join(dir, "_fonts/Geist-OFL.txt"), "utf8")).toContain(
      "SIL Open Font License",
    )
  })
})
