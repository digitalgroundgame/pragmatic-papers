import { globSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { isolatedDocs } from "../isolatedDocs"

const root = path.resolve(__dirname, "../../..")
const storyFiles = globSync("src/**/*.stories.tsx", { cwd: root })

describe("isolatedDocs", () => {
  it("renders each story in its own iframe on the docs page", () => {
    expect(isolatedDocs("400px")).toEqual({ docs: { story: { inline: false, height: "400px" } } })
  })

  // Inline on the docs page, every story's fetch stub lands on one window and
  // the last one answers them all, so a story that should load shows nothing.
  it("is used by every story file that stubs window.fetch", () => {
    const stubbing = storyFiles.filter((file) =>
      /spyOn\(\s*window\s*,\s*["']fetch["']\s*\)/.test(readFileSync(path.join(root, file), "utf8")),
    )
    expect(stubbing.length).toBeGreaterThan(0)
    const missing = stubbing.filter(
      (file) => !readFileSync(path.join(root, file), "utf8").includes("isolatedDocs("),
    )
    expect(missing).toEqual([])
  })
})
