/**
 * oklch → sRGB hex, for checking the hex copies rasterizers need against the oklch tokens.
 * Björn Ottosson's matrices, https://bottosson.github.io/posts/oklab/.
 */

/** Reads `oklch(L C H)` or `oklch(L C H / A)` (L may be a percentage); null for anything else. */
export function parseOklch(value: string): { l: number; c: number; h: number } | null {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/[^)]*)?\)$/.exec(value.trim())
  if (!match) return null
  const l = parseFloat(match[1]!) / (match[2] ? 100 : 1)
  return { l, c: parseFloat(match[3]!), h: parseFloat(match[4]!) }
}

const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

/** The nearest `#rrggbb` (alpha dropped, out-of-gamut channels clipped). */
export function oklchToHex({ l: L, c, h }: { l: number; c: number; h: number }): string {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}
