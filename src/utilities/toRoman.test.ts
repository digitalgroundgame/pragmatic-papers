import { toRoman } from "./toRoman"

describe("toRoman", () => {
  it("converts 1 to I", () => {
    expect(toRoman(1)).toBe("I")
  })

  it("converts 4 to IV", () => {
    expect(toRoman(4)).toBe("IV")
  })

  it("converts 5 to V", () => {
    expect(toRoman(5)).toBe("V")
  })

  it("converts 9 to IX", () => {
    expect(toRoman(9)).toBe("IX")
  })

  it("converts 10 to X", () => {
    expect(toRoman(10)).toBe("X")
  })

  it("converts 50 to L", () => {
    expect(toRoman(50)).toBe("L")
  })

  it("converts 100 to C", () => {
    expect(toRoman(100)).toBe("C")
  })

  it("converts 500 to D", () => {
    expect(toRoman(500)).toBe("D")
  })

  it("converts 1000 to M", () => {
    expect(toRoman(1000)).toBe("M")
  })

  it("converts 1994 to MCMXCIV", () => {
    expect(toRoman(1994)).toBe("MCMXCIV")
  })

  it("converts 3999 to MMMCMXCIX (max standard roman numeral)", () => {
    expect(toRoman(3999)).toBe("MMMCMXCIX")
  })
})
