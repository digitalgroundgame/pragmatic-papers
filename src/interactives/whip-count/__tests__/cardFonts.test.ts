// @vitest-environment node
import { existsSync, readFileSync } from "node:fs"
import type * as fsPromises from "node:fs/promises"

import { afterEach, describe, expect, it, vi } from "vitest"

const { readFile, files } = vi.hoisted(() => ({
  readFile: vi.fn(),
  files: { read: undefined as unknown as (...args: never[]) => unknown },
}))
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof fsPromises>()
  files.read = actual.readFile as never
  readFile.mockImplementation(actual.readFile)
  return { ...actual, readFile }
})

const { CARD_FONTS, loadCardFonts } = await import("../cardFonts")

const CONTEXT = Symbol.for("__cloudflare-context__")
const global = globalThis as Record<symbol, unknown>

/** The Worker's static assets as `pnpm build:worker` lays them out. */
const assets = (status = 200) => ({
  fetch: vi.fn(async (input: Request | URL | string) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname
    const font = CARD_FONTS.find((f) => f.asset === path)
    return font && status === 200
      ? new Response(readFileSync(font.file))
      : new Response(null, { status: font ? status : 404 })
  }),
})

describe("the link preview card's fonts", () => {
  afterEach(() => {
    delete global[CONTEXT]
    readFile.mockReset().mockImplementation(files.read)
  })

  it("names TTFs the packages ship, each at its own path in the Worker's assets", () => {
    for (const font of CARD_FONTS) {
      expect(existsSync(font.file), font.file).toBe(true)
      // A TrueType font starts 00 01 00 00.
      expect(readFileSync(font.file).readUInt32BE(0), font.file).toBe(0x00010000)
      expect(font.asset).toMatch(/^\/og-fonts\/[\w-]+\.ttf$/)
    }
    expect(new Set(CARD_FONTS.map((f) => f.asset)).size).toBe(CARD_FONTS.length)
  })

  it("reads them from the packages on Coolify", async () => {
    const fonts = await loadCardFonts()
    expect(fonts?.map((f) => `${f.name} ${f.weight}`)).toEqual([
      "Geist 400",
      "Geist 600",
      "Geist 700",
      "Libertinus Serif 700",
    ])
    expect(fonts?.every((f) => f.data.byteLength > 50_000)).toBe(true)
  })

  it("fetches them from the Worker's static assets when there are no files", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"))
    const worker = assets()
    global[CONTEXT] = { env: { ASSETS: worker } }
    const fonts = await loadCardFonts()
    expect(worker.fetch).toHaveBeenCalledTimes(CARD_FONTS.length)
    expect(fonts?.map((f) => f.data.byteLength)).toEqual(
      CARD_FONTS.map((f) => readFileSync(f.file).byteLength),
    )
  })

  it("leaves next/og its own font when neither has them", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"))
    expect(await loadCardFonts()).toBeUndefined()
    global[CONTEXT] = { env: { ASSETS: assets(404) } }
    expect(await loadCardFonts()).toBeUndefined()
  })
})
