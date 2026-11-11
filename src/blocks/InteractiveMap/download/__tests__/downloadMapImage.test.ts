import { describe, expect, it } from "vitest"

import { mapFileName } from "../downloadMapImage"

describe("mapFileName", () => {
  it.each([
    ["Districts & margins", "districts-margins.png"],
    ["Missouri's 2026 map — before/after", "missouris-2026-map-beforeafter.png"],
    ["  Señor   Café  ", "senor-cafe.png"],
    ["", "map.png"],
    [null, "map.png"],
    ["!!!", "map.png"],
  ])("names %j as %s", (title, name) => {
    expect(mapFileName(title)).toBe(name)
  })
})
