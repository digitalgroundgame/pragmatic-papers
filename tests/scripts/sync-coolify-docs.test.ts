import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  type Manifest,
  rawUrl,
  staleFiles,
  validatePages,
  VENDOR_DIR,
} from "../../scripts/sync-coolify-docs"

const manifest = JSON.parse(readFileSync(join(VENDOR_DIR, "manifest.json"), "utf-8")) as Manifest

describe("sync-coolify-docs", () => {
  it("builds raw URLs pinned to a commit", () => {
    expect(rawUrl(manifest, "abc123", "content/docs/core/security-model.mdx")).toBe(
      "https://raw.githubusercontent.com/coollabsio/coolify-docs/abc123/content/docs/core/security-model.mdx",
    )
  })

  it("finds files the manifest no longer lists", () => {
    expect(staleFiles(["a.mdx", "b/c.mdx"], ["b/c.mdx"])).toEqual(["a.mdx"])
  })

  it.each(["../etc/passwd.mdx", "/abs.mdx", "core/image.webp"])("rejects %j", (page) => {
    expect(() => validatePages([page])).toThrow(/Not a docs page path/)
  })

  it("rejects a page listed twice", () => {
    expect(() => validatePages(["a.mdx", "a.mdx"])).toThrow(/Listed twice: a.mdx/)
  })

  it("has exactly the manifest's pages on disk, from a recorded commit", () => {
    validatePages(manifest.pages)
    expect(manifest.commit).toMatch(/^[0-9a-f]{40}$/)
    const onDisk = readdirSync(join(VENDOR_DIR, "pages"), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        join(entry.parentPath, entry.name).slice(join(VENDOR_DIR, "pages").length + 1),
      )
    expect(onDisk.sort()).toEqual([...manifest.pages].sort())
  })
})
