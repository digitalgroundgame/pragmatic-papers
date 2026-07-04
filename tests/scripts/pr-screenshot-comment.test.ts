import { describe, expect, it } from "vitest"

import { extractFingerprint, fingerprintFiles } from "../../scripts/pr-screenshot-comment"

describe("extractFingerprint", () => {
  it("extracts the fingerprint for the given marker", () => {
    const body = "<!-- visual-regressions:deadbeef -->\n## Title"
    expect(extractFingerprint(body, "visual-regressions")).toBe("deadbeef")
  })

  it("returns null when the marker does not match", () => {
    const body = "<!-- screenshots:deadbeef -->\n## Title"
    expect(extractFingerprint(body, "visual-regressions")).toBeNull()
  })

  it("returns an empty string for an empty fingerprint", () => {
    expect(extractFingerprint("<!-- screenshots: -->", "screenshots")).toBe("")
  })

  it("returns null when the marker is not at the start of the body", () => {
    expect(extractFingerprint("hello\n<!-- screenshots:ab -->", "screenshots")).toBeNull()
  })
})

describe("fingerprintFiles", () => {
  const readFile = (path: unknown) => Buffer.from(`contents of ${path}`)

  it("is order-independent", () => {
    const a = fingerprintFiles(["x/a.png", "y/b.png"], readFile as never)
    const b = fingerprintFiles(["y/b.png", "x/a.png"], readFile as never)
    expect(a).toBe(b)
  })

  it("changes when file contents change", () => {
    const a = fingerprintFiles(["a.png"], (() => Buffer.from("one")) as never)
    const b = fingerprintFiles(["a.png"], (() => Buffer.from("two")) as never)
    expect(a).not.toBe(b)
  })

  it("produces a hex sha256 digest", () => {
    expect(fingerprintFiles(["a.png"], readFile as never)).toMatch(/^[0-9a-f]{64}$/)
  })
})
