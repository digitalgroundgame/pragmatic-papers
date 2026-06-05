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

const DEFAULT_NEUTRAL = "var(--map-neutral, #f1efe8)"

const DIVERGING_RED_BLUE = {
  breakpoints: [1, 5, 15],
  positive: [
    "var(--map-positive-1, #fde8ec)",
    "var(--map-positive-2, #f9bcc7)",
    "var(--map-positive-3, #f08c9d)",
    "var(--map-positive-4, #da1333)",
  ],
  negative: [
    "var(--map-negative-1, #c5dbfa)",
    "var(--map-negative-2, #8abaf2)",
    "var(--map-negative-3, #3e89e7)",
    "var(--map-negative-4, #1144ff)",
  ],
} as const

export function formatDivergingMargin(value: number): string {
  const sign = value >= 0 ? "R+" : "D+"
  return `${sign}${Math.abs(value).toFixed(1)}`
}

export function pickDivergingColor(value: number, bias = 1): string {
  const abs = Math.abs(value) * bias
  const { breakpoints, positive, negative } = DIVERGING_RED_BLUE
  const palette = value >= 0 ? positive : negative
  const fallback = palette[palette.length - 1] ?? "#000000"
  for (let i = 0; i < breakpoints.length; i++) {
    const stop = breakpoints[i]
    const color = palette[i]
    if (stop !== undefined && color && abs < stop) return color
  }
  return fallback
}

interface ResolveColorArgs {
  scaleType: ColorScaleType
  value: number | null | undefined
  overrideColor: string | null | undefined
  bias?: number
  neutralFill?: string
}

export function resolveColor({
  scaleType,
  value,
  overrideColor,
  bias = 1,
  neutralFill = DEFAULT_NEUTRAL,
}: ResolveColorArgs): string {
  if (overrideColor) return overrideColor
  if (scaleType === "divergingRedBlue" && typeof value === "number") {
    return pickDivergingColor(value, bias)
  }
  return neutralFill
}

export function formatValue(format: ValueFormat, value: number | null | undefined): string | null {
  if (typeof value !== "number") return null
  if (format === "none") return null
  if (format === "r+d-") return formatDivergingMargin(value)
  if (format === "percent") return `${value.toFixed(1)}%`
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
}
