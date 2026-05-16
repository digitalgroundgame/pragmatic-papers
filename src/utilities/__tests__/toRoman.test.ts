import { describe, expect, it } from "vitest"
import { toRoman } from "../toRoman"

describe("toRoman", () => {
  it("converts boundary subtractive pairs", () => {
    expect(toRoman(4)).toBe("IV")
    expect(toRoman(9)).toBe("IX")
    expect(toRoman(40)).toBe("XL")
    expect(toRoman(90)).toBe("XC")
    expect(toRoman(400)).toBe("CD")
    expect(toRoman(900)).toBe("CM")
  })

  it("converts additive values", () => {
    expect(toRoman(1)).toBe("I")
    expect(toRoman(5)).toBe("V")
    expect(toRoman(10)).toBe("X")
    expect(toRoman(50)).toBe("L")
    expect(toRoman(100)).toBe("C")
    expect(toRoman(500)).toBe("D")
    expect(toRoman(1000)).toBe("M")
  })

  it("converts compound numbers", () => {
    expect(toRoman(14)).toBe("XIV")
    expect(toRoman(42)).toBe("XLII")
    expect(toRoman(1999)).toBe("MCMXCIX")
    expect(toRoman(2024)).toBe("MMXXIV")
  })
})
