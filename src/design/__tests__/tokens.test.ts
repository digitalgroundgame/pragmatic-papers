import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { parseThemes } from "../cssTokens"
import { COLOR_GROUPS, OTHER_TOKENS } from "../tokens"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const globalsCss = readFileSync(path.resolve(dirname, "../../app/(frontend)/globals.css"), "utf8")
const themes = parseThemes(globalsCss)
const documented = new Set([
  ...COLOR_GROUPS.flatMap((group) => group.tokens.map((token) => token.name)),
  ...Object.keys(OTHER_TOKENS),
])

describe("parseThemes", () => {
  it("reads :root as light and lets .dark override it", () => {
    const css = [
      ":root {",
      "  /* a comment: with a colon; and a semicolon */",
      "  --a: red;",
      "  --b: oklch(1 0 0 / 10%);",
      "}",
      ".dark {",
      "  --a: blue;",
      "}",
      ":root:has(.x) {",
      "  --a: green;",
      "}",
      "@media (min-width: 48rem) {",
      "  :root {",
      "    --b: pink;",
      "  }",
      "}",
    ].join("\n")
    expect(parseThemes(css)).toEqual({
      light: { a: "red", b: "oklch(1 0 0 / 10%)" },
      dark: { a: "blue", b: "oklch(1 0 0 / 10%)" },
    })
  })

  it("finds the brand color in globals.css", () => {
    expect(themes.light.brand).toBe("oklch(0.6567 0.2311 32.7)")
    // brand-fill is the same in both themes; brand-text has a dark value of its own.
    expect(themes.dark["brand-fill"]).toBe(themes.light["brand-fill"])
    expect(themes.dark["brand-text"]).not.toBe(themes.light["brand-text"])
  })
})

describe("the design guide's tokens", () => {
  it("lists every custom property globals.css sets", () => {
    const set = new Set([...Object.keys(themes.light), ...Object.keys(themes.dark)])
    expect([...set].filter((name) => !documented.has(name))).toEqual([])
  })

  it("lists only tokens globals.css sets", () => {
    const colors = COLOR_GROUPS.flatMap((group) => group.tokens.map((token) => token.name))
    expect(colors.filter((name) => !(name in themes.light))).toEqual([])
  })
})
