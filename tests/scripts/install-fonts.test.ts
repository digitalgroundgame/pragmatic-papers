import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "../..")
const FONTS_DIR = resolve(ROOT, "public/fonts")
const FONT_FILE = resolve(FONTS_DIR, "FKScreamer-Bold.woff2")
const PRIVATE_FONTS_SRC = resolve(
  ROOT,
  "node_modules/@digitalgroundgame/fonts/assets/FKScreamer-2.0.3/woff2-static",
)

function runScript(env: Record<string, string> = {}) {
  return spawnSync("node", [resolve(ROOT, "scripts/install-fonts.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_FONT_READ: "", ...env },
  })
}

describe("install-fonts.mjs", () => {
  let savedFont: Buffer | null = null

  beforeEach(() => {
    savedFont = existsSync(FONT_FILE) ? readFileSync(FONT_FILE) : null
    rmSync(FONTS_DIR, { recursive: true, force: true })
    mkdirSync(FONTS_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(FONTS_DIR, { recursive: true, force: true })
    if (savedFont !== null) {
      mkdirSync(FONTS_DIR, { recursive: true })
      writeFileSync(FONT_FILE, savedFont)
    }
    rmSync(resolve(ROOT, "node_modules/@digitalgroundgame"), {
      recursive: true,
      force: true,
    })
  })

  describe("when the private fonts package is installed", () => {
    beforeEach(() => {
      mkdirSync(PRIVATE_FONTS_SRC, { recursive: true })
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), "fake-font-data")
    })

    it("copies fonts to public/fonts and exits 0", () => {
      const result = runScript()
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Fonts copied to public/fonts")
    })

    it("copies the font file contents", () => {
      runScript()
      expect(readFileSync(FONT_FILE, "utf8")).toBe("fake-font-data")
    })
  })

  describe("when the font is already installed (file > 1000 bytes)", () => {
    beforeEach(() => {
      writeFileSync(FONT_FILE, Buffer.alloc(1001, 0x41))
    })

    it("exits 0 without overwriting the file", () => {
      const result = runScript()
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("already installed (real)")
      expect(readFileSync(FONT_FILE).byteLength).toBe(1001)
    })
  })

  describe("when no fonts are available and GH_FONT_READ is not set", () => {
    it("copies Inter Bold as fallback and exits 0", () => {
      const result = runScript({ GH_FONT_READ: "" })
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
    })

    it("writes a non-empty fallback font file", () => {
      runScript({ GH_FONT_READ: "" })
      expect(existsSync(FONT_FILE)).toBe(true)
      expect(readFileSync(FONT_FILE).byteLength).toBeGreaterThan(0)
    })

    it("logs that the package is not installed", () => {
      const result = runScript({ GH_FONT_READ: "" })
      expect(result.stderr).toContain("@digitalgroundgame/fonts is not installed")
    })

    it("explains the missing token", () => {
      const result = runScript({ GH_FONT_READ: "" })
      expect(result.stderr).toContain("GH_FONT_READ environment variable is not set")
    })
  })

  describe("when no fonts are available and GH_FONT_READ is set", () => {
    it("copies Inter Bold as fallback and exits 0", () => {
      const result = runScript({ GH_FONT_READ: "fake-token" })
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
    })

    it("explains that the token is set but package was not found", () => {
      const result = runScript({ GH_FONT_READ: "fake-token" })
      expect(result.stderr).toContain("GH_FONT_READ is set, but the package was not found")
    })
  })

  describe("when a stale small placeholder exists (< 1000 bytes)", () => {
    beforeEach(() => {
      writeFileSync(FONT_FILE, Buffer.alloc(100, 0x00))
    })

    it("overwrites the placeholder with the fallback font", () => {
      runScript()
      expect(readFileSync(FONT_FILE).byteLength).toBeGreaterThan(0)
    })

    it("does not report fonts as already installed", () => {
      const result = runScript()
      expect(result.stderr).not.toContain("already installed")
    })
  })
})
