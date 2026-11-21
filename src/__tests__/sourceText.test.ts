// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(import.meta.dirname, "../..")

/** Every TypeScript file under `dir`, as paths from the repository root. */
function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx|mts)$/.test(file))
    .map((file) => path.join(dir, file))
}

describe("source files", () => {
  // Git and grep treat a file holding a NUL as binary, so its diff never shows in a review.
  // Write the character as an escape ("\u0000") instead.
  it("hold no raw NUL characters", () => {
    const binary = ["src", "scripts", "tests"]
      .flatMap(sourceFiles)
      .filter((file) => readFileSync(path.join(ROOT, file)).includes(0))
    expect(binary).toEqual([])
  })
})
