import { type LegendEntry } from "./Legend"

export type ColorScaleType = "divergingRedBlue" | "perRegion"
export type ValueFormat = "r+d-" | "number" | "percent" | "none"

const FORMAT_BY_ATTRIBUTE: Record<string, ValueFormat> = {
  margin: "r+d-",
  percent: "percent",
  number: "number",
}

export function inferValueFormat(dataAttribute: string | null | undefined): ValueFormat {
  if (!dataAttribute) return "none"
  const key = dataAttribute.toLowerCase().replace(/^data-/, "")
  return FORMAT_BY_ATTRIBUTE[key] ?? "number"
}

export const DEFAULT_NEUTRAL = "var(--map-neutral, oklch(0.9528 0.0086 84.57))"

const DOMAIN_MAX = 100

const DIVERGING_RED_BLUE = {
  breakpoints: [1, 5, 15, 30],
  positive: [
    "var(--map-positive-1, #ffb8bc)",
    "var(--map-positive-2, #f48088)",
    "var(--map-positive-3, #e54858)",
    "var(--map-positive-4, #d81334)",
  ],
  negative: [
    "var(--map-negative-1, #b4d4f8)",
    "var(--map-negative-2, #72aef3)",
    "var(--map-negative-3, #2c86ed)",
    "var(--map-negative-4, #126ace)",
  ],
} as const

export function formatDivergingMargin(value: number): string {
  const sign = value >= 0 ? "R+" : "D+"
  return `${sign}${Math.abs(value).toFixed(1)}`
}

// Applies a power-law curve in log-space between firstBp and lastBp, leaving
// both endpoints pinned. bias > 1 pushes transitions earlier (more vivid for
// small margins); bias < 1 pushes them later. bias = 1 is identity.
function applyBiasCurve(abs: number, firstBp: number, lastBp: number, power: number): number {
  if (power === 1 || abs <= firstBp || abs >= lastBp || lastBp <= firstBp) return abs
  const logRange = Math.log(lastBp / firstBp)
  const t = Math.log(abs / firstBp) / logRange
  return firstBp * Math.exp(Math.pow(t, power) * logRange)
}

export function pickDivergingColor(value: number, bias = 1, invert = false): string | null {
  const abs = Math.abs(value)
  const { breakpoints, positive, negative } = DIVERGING_RED_BLUE
  const firstBp = breakpoints[0] ?? 0
  if (abs < firstBp) return null
  const palette = value >= 0 !== invert ? positive : negative
  const fallback = palette[palette.length - 1] ?? "#000000"
  // bias > 1 → forward power = 1/bias < 1 → t^(1/bias) > t → adjusted higher → darker tier
  const compareAbs = applyBiasCurve(abs, firstBp, DOMAIN_MAX, 1 / Math.max(bias, 0.001))
  for (let i = 1; i < breakpoints.length; i++) {
    const stop = breakpoints[i]
    const color = palette[i - 1]
    if (stop !== undefined && color && compareAbs < stop) return color
  }
  return fallback
}

interface ResolveColorArgs {
  scaleType: ColorScaleType
  value: number | null | undefined
  overrideColor: string | null | undefined
  bias?: number
  invert?: boolean | null
  neutralFill?: string
}

export function resolveColor({
  scaleType,
  value,
  overrideColor,
  bias = 1,
  invert = false,
  neutralFill = DEFAULT_NEUTRAL,
}: ResolveColorArgs): string {
  if (overrideColor) return overrideColor
  if (scaleType === "divergingRedBlue" && typeof value === "number") {
    return pickDivergingColor(value, bias, Boolean(invert)) ?? neutralFill
  }
  return neutralFill
}

function fmtThreshold(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1)
}

export function getDivergingRedBlueLegend(bias: number | null = 1): LegendEntry[] {
  const bp = DIVERGING_RED_BLUE.breakpoints
  const firstBp = bp[0] ?? 1
  // Inverse of the forward curve: use bias as the power to find the actual
  // value that produces each breakpoint threshold.
  const b = Math.max(bias ?? 1, 0.001)
  const t = bp.map((v) => applyBiasCurve(v, firstBp, DOMAIN_MAX, b))
  return [
    { color: DIVERGING_RED_BLUE.negative[3], label: `≥D+${fmtThreshold(t[3]!)}` },
    { color: DIVERGING_RED_BLUE.negative[2], label: `≥D+${fmtThreshold(t[2]!)}` },
    { color: DIVERGING_RED_BLUE.negative[1], label: `≥D+${fmtThreshold(t[1]!)}` },
    { color: DIVERGING_RED_BLUE.negative[0], label: `≥D+${fmtThreshold(t[0]!)}` },
    { color: DEFAULT_NEUTRAL, label: `±${fmtThreshold(firstBp)}` },
    { color: DIVERGING_RED_BLUE.positive[0], label: `≥R+${fmtThreshold(t[0]!)}` },
    { color: DIVERGING_RED_BLUE.positive[1], label: `≥R+${fmtThreshold(t[1]!)}` },
    { color: DIVERGING_RED_BLUE.positive[2], label: `≥R+${fmtThreshold(t[2]!)}` },
    { color: DIVERGING_RED_BLUE.positive[3], label: `≥R+${fmtThreshold(t[3]!)}` },
  ]
}

export function formatValue(format: ValueFormat, value: number | null | undefined): string | null {
  if (typeof value !== "number") return null
  if (format === "none") return null
  if (format === "r+d-") return formatDivergingMargin(value)
  if (format === "percent") return `${value.toFixed(1)}%`
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
}
