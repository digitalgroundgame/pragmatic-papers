import path from "node:path"
import { describe, expect, it } from "vitest"

import { sameFile } from "../../.storybook/sameFile"

describe("sameFile", () => {
  it("matches a Vite id against a resolved path on Windows", () => {
    expect(
      sameFile("C:/repo/src/data/payload.ts", "C:\\repo\\src\\data\\payload.ts", path.win32),
    ).toBe(true)
  })

  it("ignores a query and the drive letter's case on Windows", () => {
    expect(
      sameFile("c:/repo/src/data/payload.ts?v=1a2b", "C:\\repo\\src\\data\\payload.ts", path.win32),
    ).toBe(true)
  })

  it("tells different files apart", () => {
    expect(
      sameFile(
        "C:/repo/src/data/payload.ts",
        "C:\\repo\\src\\stories\\mocks\\payload.ts",
        path.win32,
      ),
    ).toBe(false)
    expect(sameFile("/repo/src/data/payload.ts", "/repo/src/stories/mocks/payload.ts")).toBe(false)
  })

  it("matches the same POSIX path, with or without a query", () => {
    expect(sameFile("/repo/src/data/payload.ts?import", "/repo/src/data/payload.ts")).toBe(true)
  })
})
