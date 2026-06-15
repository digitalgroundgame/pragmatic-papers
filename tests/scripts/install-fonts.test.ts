import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(__dirname, "../../scripts/install-fonts.ts")

function runScript(cwd: string, env: Record<string, string> = {}) {
  return spawnSync("tsx", [SCRIPT], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GH_FONT_READ: "", ...env },
  })
}

describe("install-fonts.ts", () => {
  let tmpRoot: string
  let FONTS_DIR: string
  let FONT_FILE: string
  let PRIVATE_FONTS_SRC: string

  beforeEach(() => {
    tmpRoot = resolve(
      tmpdir(),
      `install-fonts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    FONTS_DIR = resolve(tmpRoot, "public/fonts")
    FONT_FILE = resolve(FONTS_DIR, "FKScreamer-Bold.woff2")
    PRIVATE_FONTS_SRC = resolve(
      tmpRoot,
      "node_modules/@digitalgroundgame/fonts/assets/FKScreamer-2.0.3/woff2-static",
    )
    mkdirSync(FONTS_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  describe("when the private fonts package is installed", () => {
    beforeEach(() => {
      mkdirSync(PRIVATE_FONTS_SRC, { recursive: true })
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), "fake-font-data")
    })

    it("copies fonts to public/fonts and exits 0", () => {
      const result = runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Fonts copied to public/fonts")
    })

    it("copies the font file contents", () => {
      runScript(tmpRoot)
      expect(readFileSync(FONT_FILE, "utf8")).toBe("fake-font-data")
    })
  })

  describe("when the font is already installed (file > 1000 bytes)", () => {
    beforeEach(() => {
      writeFileSync(FONT_FILE, Buffer.alloc(1001, 0x41))
    })

    it("exits 0 without overwriting the file", () => {
      const result = runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("already installed (real)")
      expect(readFileSync(FONT_FILE).byteLength).toBe(1001)
    })
  })

  describe("when no fonts are available and GH_FONT_READ is not set", () => {
    it("copies Inter Bold as fallback and exits 0", () => {
      const result = runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
    })

    it("writes a non-empty fallback font file", () => {
      runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(existsSync(FONT_FILE)).toBe(true)
      expect(readFileSync(FONT_FILE).byteLength).toBeGreaterThan(0)
    })

    it("logs that the package is not installed", () => {
      const result = runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(result.stderr).toContain("@digitalgroundgame/fonts is not installed")
    })

    it("explains the missing token", () => {
      const result = runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(result.stderr).toContain("GH_FONT_READ environment variable is not set")
    })
  })

  describe("when no fonts are available and GH_FONT_READ is set", () => {
    it("copies Inter Bold as fallback and exits 0", () => {
      const result = runScript(tmpRoot, { GH_FONT_READ: "fake-token" })
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
    })

    it("explains that the token is set but package was not found", () => {
      const result = runScript(tmpRoot, { GH_FONT_READ: "fake-token" })
      expect(result.stderr).toContain("GH_FONT_READ is set, but the package was not found")
    })
  })

  describe("when a stale small placeholder exists (< 1000 bytes)", () => {
    beforeEach(() => {
      writeFileSync(FONT_FILE, Buffer.alloc(100, 0x00))
    })

    it("overwrites the placeholder with the fallback font", () => {
      runScript(tmpRoot)
      expect(readFileSync(FONT_FILE).byteLength).toBeGreaterThan(0)
    })

    it("does not report fonts as already installed", () => {
      const result = runScript(tmpRoot)
      expect(result.stderr).not.toContain("already installed")
    })
  })
})
