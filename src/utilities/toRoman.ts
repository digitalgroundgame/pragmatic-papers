export function toRoman(x: number): string {
  // array of values and symbols
  const base = [1, 4, 5, 9, 10, 40, 50, 90, 100, 400, 500, 900, 1000]
  const sym = ["I", "IV", "V", "IX", "X", "XL", "L", "XC", "C", "CD", "D", "CM", "M"]

  // to store result
  let res = ""

  // Loop from the right side to find
  // the largest smaller base value
  let i = base.length - 1
  while (x > 0) {
    if (typeof base[i] !== "undefined") {
      let div = Math.floor(x / base[i]!)
      while (div) {
        res += sym[i]
        div--
      }
    }

    // Repeat the process for remainder
    if (typeof base[i] !== "undefined") {
      x %= base[i] as number
    }
    i--
  }

  return res
}
