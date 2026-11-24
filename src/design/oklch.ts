/**
 * Conversions between sRGB hex and OKLCH, for checking the hex copies of theme colors that
 * rasterizers need (sharp/librsvg and next/og don't read `oklch()`) against the tokens in
 * globals.css. Björn Ottosson's matrices, https://bottosson.github.io/posts/oklab/.
 */

export interface Oklch {
  /** Lightness, 0–1. */
  l: number
  c: number
  /** Hue in degrees. */
  h: number
  /** Alpha, 0–1. */
  alpha: number
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** `#rgb` or `#rrggbb` as OKLCH. */
export function hexToOklch(hex: string): Oklch {
  const digits = hex.replace("#", "")
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const [L, A, B] = rgbToOklab(r, g, b)
  const c = Math.hypot(A, B)
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return { l: L, c: c < 1e-4 ? 0 : c, h, alpha: 1 }
}

/** Reads `oklch(L C H)` or `oklch(L C H / A)`; L and A may be percentages. */
export function parseOklch(value: string): Oklch | null {
  const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)$/.exec(
    value.trim(),
  )
  if (!match) return null
  const unit = (v: string) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v))
  return {
    l: unit(match[1] ?? "0"),
    c: parseFloat(match[2] ?? "0"),
    h: parseFloat(match[3] ?? "0"),
    alpha: match[4] ? unit(match[4]) : 1,
  }
}

/** The nearest sRGB hex, `#rrggbb` (alpha dropped; out-of-gamut channels clipped). */
export function oklchToHex({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180
  const rgb = oklabToRgb(l, c * Math.cos(rad), c * Math.sin(rad))
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

/** `oklch(L C H)` for a hex color, rounded so it converts back to the same hex. */
export function formatOklch(hex: string): string {
  const { l, c, h } = hexToOklch(hex)
  for (const digits of [3, 4, 5]) {
    const round = (v: number) => Number(v.toFixed(digits))
    const candidate = {
      l: round(l),
      c: round(c),
      h: Number(h.toFixed(Math.max(1, digits - 2))),
      alpha: 1,
    }
    if (oklchToHex(candidate) === hex.toLowerCase()) {
      return `oklch(${candidate.l} ${candidate.c} ${candidate.h})`
    }
  }
  return `oklch(${l} ${c} ${h})`
}
