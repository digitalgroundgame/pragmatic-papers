import { describe, expect, it } from "vitest"

import {
  checkPins,
  getPinnedTags,
  getResolvedPlaywrightVersion,
} from "../../scripts/check-playwright-image-pin"

function lockfile(version: string, specifier = `^${version}`) {
  return `      '@playwright/test':\n        specifier: ${specifier}\n        version: ${version}\n`
}

function pin(version: string, codename = "noble") {
  return `image: mcr.microsoft.com/playwright:v${version}-${codename}`
}

describe("getResolvedPlaywrightVersion", () => {
  it("extracts the resolved version from a pnpm-lock.yaml snippet", () => {
    expect(getResolvedPlaywrightVersion(lockfile("1.60.0"))).toBe("1.60.0")
  })

  it("throws when the lockfile has no '@playwright/test' entry", () => {
    expect(() => getResolvedPlaywrightVersion("no relevant lines here\n")).toThrow(
      "Could not find '@playwright/test' resolved version in pnpm-lock.yaml",
    )
  })
})

describe("getPinnedTags", () => {
  it("finds a single pinned image tag", () => {
    expect(getPinnedTags(pin("1.60.0"))).toEqual([{ version: "1.60.0", codename: "noble" }])
  })

  it("finds multiple pinned tags in the same file", () => {
    const contents = [pin("1.60.0"), pin("1.60.0")].join("\n")
    expect(getPinnedTags(contents)).toEqual([
      { version: "1.60.0", codename: "noble" },
      { version: "1.60.0", codename: "noble" },
    ])
  })

  it("returns an empty array when no image tag is present", () => {
    expect(getPinnedTags("no image reference here")).toEqual([])
  })
})

describe("checkPins", () => {
  it("returns no mismatches when every file matches the resolved version", () => {
    const mismatches = checkPins("1.60.0", {
      "docker-compose.e2e.yml": pin("1.60.0"),
      "playwright.yml": pin("1.60.0"),
    })
    expect(mismatches).toEqual([])
  })

  it("reports a file whose pinned version diverges from the resolved version", () => {
    const mismatches = checkPins("1.60.0", {
      "docker-compose.e2e.yml": pin("1.59.0"),
    })
    expect(mismatches).toEqual([
      "docker-compose.e2e.yml: pinned to v1.59.0-noble, but pnpm-lock.yaml resolves @playwright/test to 1.60.0",
    ])
  })

  it("reports a file with no image tag at all", () => {
    const mismatches = checkPins("1.60.0", { "playwright.yml": "no image tag here" })
    expect(mismatches).toEqual(["playwright.yml: no mcr.microsoft.com/playwright image tag found"])
  })

  it("reports inconsistent Ubuntu codenames across otherwise-matching files", () => {
    const mismatches = checkPins("1.60.0", {
      "docker-compose.e2e.yml": pin("1.60.0", "noble"),
      "playwright.yml": pin("1.60.0", "jammy"),
    })
    expect(mismatches).toEqual([
      "Inconsistent Ubuntu codenames pinned across files: noble, jammy — use the same base image everywhere.",
    ])
  })

  it("reports both a version mismatch and a codename mismatch together", () => {
    const mismatches = checkPins("1.60.0", {
      "docker-compose.e2e.yml": pin("1.60.0", "noble"),
      "playwright.yml": pin("1.59.0", "jammy"),
    })
    expect(mismatches).toEqual([
      "playwright.yml: pinned to v1.59.0-jammy, but pnpm-lock.yaml resolves @playwright/test to 1.60.0",
      "Inconsistent Ubuntu codenames pinned across files: noble, jammy — use the same base image everywhere.",
    ])
  })
})
