import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { installFonts, installSansFont } from "../../scripts/install-fonts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(__dirname, "../../scripts/install-fonts.ts")
const INTER_BOLD = readFileSync(resolve(__dirname, "../../scripts/Inter-Bold.woff2"))
const GEIST = readFileSync(
  resolve(__dirname, "../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"),
)

/** Runs the installer in-process, so coverage sees it, and collects what it logged. */
async function runScript(cwd: string, env: Record<string, string> = {}) {
  const lines: string[] = []
  const collect = (...args: unknown[]): void => void lines.push(args.join(" "))
  const warn = vi.spyOn(console, "warn").mockImplementation(collect)
  const error = vi.spyOn(console, "error").mockImplementation(collect)
  try {
    const status = await installFonts(cwd, { GH_FONT_READ: "", ...env })
    return { status, stderr: lines.join("\n") }
  } finally {
    warn.mockRestore()
    error.mockRestore()
  }
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

  describe("when public/fonts does not exist", () => {
    beforeEach(() => {
      rmSync(FONTS_DIR, { recursive: true, force: true })
    })

    it("creates the directory and installs the fallback font", async () => {
      const result = await runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(existsSync(FONTS_DIR)).toBe(true)
      expect(existsSync(FONT_FILE)).toBe(true)
    })
  })

  describe("when the private fonts package is installed", () => {
    beforeEach(() => {
      mkdirSync(PRIVATE_FONTS_SRC, { recursive: true })
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), "fake-font-data")
    })

    it("copies fonts to public/fonts and exits 0", async () => {
      const result = await runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Fonts copied to public/fonts")
    })

    it("copies the font file contents", async () => {
      await runScript(tmpRoot)
      expect(readFileSync(FONT_FILE, "utf8")).toBe("fake-font-data")
    })

    it("copies all files from the package directory", async () => {
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Light.woff2"), "light-font-data")
      await runScript(tmpRoot)
      expect(readFileSync(resolve(FONTS_DIR, "FKScreamer-Light.woff2"), "utf8")).toBe(
        "light-font-data",
      )
    })

    it("flags a package file that isn't a font, and doesn't try to subset it", async () => {
      const result = await runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("isn't a WOFF2 file (14 bytes)")
      expect(result.stderr).toContain("pnpm reinstall")
      expect(result.stderr).not.toContain("subset")
    })

    it("ships a font it can't subset whole, with a warning", async () => {
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), "wOF2-broken-font-data")
      const result = await runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Could not subset FKScreamer, shipping it whole")
    })

    it("subsets a real font to the characters and features the site uses", async () => {
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), INTER_BOLD)
      const result = await runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Subset FKScreamer-Bold.woff2")
      const subset = readFileSync(FONT_FILE)
      expect(subset.subarray(0, 4).toString("latin1")).toBe("wOF2")
      expect(subset.byteLength).toBeLessThan(INTER_BOLD.byteLength)
    })

    it("overwrites an existing font rather than skipping it", async () => {
      writeFileSync(FONT_FILE, Buffer.alloc(2000, 0x41))
      await runScript(tmpRoot)
      expect(readFileSync(FONT_FILE, "utf8")).toBe("fake-font-data")
    })
  })

  describe("when the font is already installed (file > 1000 bytes)", () => {
    beforeEach(() => {
      writeFileSync(FONT_FILE, Buffer.alloc(1001, 0x41))
    })

    it("exits 0 without overwriting the file", async () => {
      const result = await runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("already installed (real)")
      expect(readFileSync(FONT_FILE).byteLength).toBe(1001)
    })
  })

  describe("when no fonts are available and GH_FONT_READ is not set", () => {
    it("copies Inter Bold as fallback and exits 0", async () => {
      const result = await runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
    })

    it("writes the exact Inter Bold fallback file", async () => {
      await runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(readFileSync(FONT_FILE)).toEqual(INTER_BOLD)
    })

    it("logs that the package is not installed", async () => {
      const result = await runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(result.stderr).toContain("@digitalgroundgame/fonts is not installed")
    })

    it("explains the missing token", async () => {
      const result = await runScript(tmpRoot, { GH_FONT_READ: "" })
      expect(result.stderr).toContain("GH_FONT_READ environment variable is not set")
    })
  })

  describe("when no fonts are available and GH_FONT_READ is set", () => {
    it("copies Inter Bold as fallback and exits 0", async () => {
      const result = await runScript(tmpRoot, { GH_FONT_READ: "fake-token" })
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
    })

    it("explains that the token is set but package was not found", async () => {
      const result = await runScript(tmpRoot, { GH_FONT_READ: "fake-token" })
      expect(result.stderr).toContain("GH_FONT_READ is set, but the package was not found")
    })
  })

  describe("when FONTS_REQUIRED is set (deploy builds)", () => {
    it("fails instead of silently shipping the Inter fallback", async () => {
      const result = await runScript(tmpRoot, {
        FONTS_REQUIRED: "true",
        GH_FONT_READ: "expired-token",
      })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("refusing to fall back to Inter")
      expect(existsSync(FONT_FILE)).toBe(false)
    })

    it("still reports why the package was missing before failing", async () => {
      const result = await runScript(tmpRoot, {
        FONTS_REQUIRED: "true",
        GH_FONT_READ: "expired-token",
      })
      expect(result.stderr).toContain("GH_FONT_READ is set, but the package was not found")
    })

    it("points at the build cache, the non-obvious half of the fix", async () => {
      const result = await runScript(tmpRoot, { FONTS_REQUIRED: "true" })
      expect(result.stderr).toContain("rebuild WITHOUT cache")
    })

    it("succeeds when the real fonts are present", async () => {
      mkdirSync(PRIVATE_FONTS_SRC, { recursive: true })
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), INTER_BOLD)
      const result = await runScript(tmpRoot, { FONTS_REQUIRED: "true" })
      expect(result.status).toBe(0)
    })

    it("fails when the package's font file isn't a font", async () => {
      mkdirSync(PRIVATE_FONTS_SRC, { recursive: true })
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), "fake-font-data")
      const result = await runScript(tmpRoot, { FONTS_REQUIRED: "true" })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("isn't a WOFF2 file")
    })

    it("rejects a stale Inter fallback left by an earlier run", async () => {
      writeFileSync(FONT_FILE, INTER_BOLD)
      const result = await runScript(tmpRoot, { FONTS_REQUIRED: "true" })
      expect(result.status).toBe(1)
    })

    it("is off by default, keeping local installs and fork CI lenient", async () => {
      const result = await runScript(tmpRoot)
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
    })
  })

  describe("when a stale Inter fallback is already installed", () => {
    beforeEach(() => {
      writeFileSync(FONT_FILE, INTER_BOLD)
    })

    it("does not mistake it for the real font", async () => {
      const result = await runScript(tmpRoot)
      expect(result.stderr).not.toContain("already installed (real)")
      expect(result.stderr).toContain("Inter fallback from an earlier run")
    })

    it("still exits 0 outside a deploy build", async () => {
      expect((await runScript(tmpRoot)).status).toBe(0)
    })

    it("is replaced once the real font becomes available", async () => {
      mkdirSync(PRIVATE_FONTS_SRC, { recursive: true })
      writeFileSync(resolve(PRIVATE_FONTS_SRC, "FKScreamer-Bold.woff2"), "fake-font-data")
      await runScript(tmpRoot)
      expect(readFileSync(FONT_FILE, "utf8")).toBe("fake-font-data")
    })
  })

  describe("when a stale small placeholder exists (< 1000 bytes)", () => {
    beforeEach(() => {
      writeFileSync(FONT_FILE, Buffer.alloc(100, 0x00))
    })

    it("overwrites the placeholder with the fallback font", async () => {
      await runScript(tmpRoot)
      expect(readFileSync(FONT_FILE)).toEqual(INTER_BOLD)
    })

    it("does not report fonts as already installed", async () => {
      const result = await runScript(tmpRoot)
      expect(result.stderr).not.toContain("already installed")
    })
  })

  describe("run as a script", () => {
    const spawn = (env: Record<string, string>) =>
      spawnSync("tsx", [SCRIPT], {
        cwd: tmpRoot,
        encoding: "utf8",
        env: { ...process.env, GH_FONT_READ: "", FONTS_REQUIRED: "", ...env },
      })

    it("installs into the working directory and exits 0", () => {
      const result = spawn({})
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Copied Inter Bold as fallback font")
      expect(readFileSync(FONT_FILE)).toEqual(INTER_BOLD)
      expect(existsSync(resolve(FONTS_DIR, "Geist-latin.woff2"))).toBe(true)
    })

    it("exits 1 when FONTS_REQUIRED can't be met", () => {
      const result = spawn({ FONTS_REQUIRED: "true" })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("refusing to fall back to Inter")
    })
  })
  describe("installSansFont", () => {
    const GEIST_FILE = () => resolve(FONTS_DIR, "Geist-latin.woff2")
    const quietly = async () => {
      const lines: string[] = []
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation((...args: unknown[]) => void lines.push(args.join(" ")))
      try {
        return { status: await installSansFont(tmpRoot), stderr: lines.join("\n") }
      } finally {
        warn.mockRestore()
      }
    }

    it("installs Geist from the geist package, trimmed, without the private fonts", async () => {
      rmSync(FONTS_DIR, { recursive: true, force: true })
      const result = await quietly()
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Installed Geist-latin.woff2 from the geist package")
      const font = readFileSync(GEIST_FILE())
      expect(font.subarray(0, 4).toString("latin1")).toBe("wOF2")
      // Latin and Latin Extended-A, weights 400–600: well under the package's 70 kB, and
      // the 29 kB Google served for latin alone.
      expect(font.byteLength).toBeLessThan(29_000)
      expect(font.byteLength).toBeLessThan(GEIST.byteLength / 2)
    })

    it("ships the whole font when subsetting fails", async () => {
      vi.doMock("subset-font", () => ({ default: () => Promise.reject(new Error("boom")) }))
      vi.resetModules()
      try {
        const { installSansFont: install } = await import("../../scripts/install-fonts")
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
        expect(await install(tmpRoot)).toBe(0)
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Could not subset Geist"))
        warn.mockRestore()
        expect(readFileSync(GEIST_FILE())).toEqual(GEIST)
      } finally {
        vi.doUnmock("subset-font")
        vi.resetModules()
      }
    })
  })
})
