import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { PRIMITIVES, SITE_COMPONENTS, storyDocsId } from "../components"

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function storyTitles(): Set<string> {
  const titles = new Set<string>()
  for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".stories.tsx")) continue
    const source = readFileSync(path.join(entry.parentPath, entry.name), "utf8")
    const title = /title:\s*"([^"]+)"/.exec(source)?.[1]
    if (title) titles.add(title)
  }
  return titles
}

describe("storyDocsId", () => {
  it("builds Storybook's id for a docs page", () => {
    expect(storyDocsId("UI/LinkButton")).toBe("ui-linkbutton--docs")
    expect(storyDocsId("Design guide/Page audit")).toBe("design-guide-page-audit--docs")
  })
})

describe("the guide's component links", () => {
  it("each point at a story that exists", () => {
    const titles = storyTitles()
    const linked = [...PRIMITIVES, ...SITE_COMPONENTS].flatMap((use) =>
      use.components.map((component) => component.title),
    )
    expect(linked.filter((title) => !titles.has(title))).toEqual([])
  })
})
