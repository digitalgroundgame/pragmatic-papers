import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { COMMON_PATTERN, PAGE_LAYOUTS } from "../pageLayouts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

describe("the page audit", () => {
  it.each(PAGE_LAYOUTS.map((page) => [page.route, page] as const))(
    "%s still has the wrapper it records",
    (_route, page) => {
      const file = path.join(root, page.source)
      expect(existsSync(file), `${page.source} is missing`).toBe(true)
      const source = readFileSync(file, "utf8")
      // A wrapper written as a tag is an element with no classes of its own.
      const needle = page.wrapper.startsWith("<") ? page.wrapper : `className="${page.wrapper}"`
      expect(source, `${page.source} no longer has ${needle}: update its entry`).toContain(needle)
    },
  )

  it("lists each route once", () => {
    const routes = PAGE_LAYOUTS.map((page) => page.route)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it("measures the others against a page that follows the common pattern", () => {
    // PageColumns draws the common column from the first page with the common wrapper.
    const reference = PAGE_LAYOUTS.find((page) => page.wrapper === COMMON_PATTERN)
    expect(reference?.deviations).toEqual([])
    expect(reference?.breadcrumbs).toBe("column")
  })
})
