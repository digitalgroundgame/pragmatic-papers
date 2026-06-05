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

const DEFAULT_NEUTRAL = "#d4d4d4"

const DIVERGING_RED_BLUE = {
  breakpoints: [1, 5, 15],
  positive: ["#dcb4ae", "#de938a", "#da685f", "#cd0526"],
  negative: ["#bbbed8", "#9fa9db", "#7890df", "#056ee3"],
} as const

export function formatDivergingMargin(value: number): string {
  const sign = value >= 0 ? "R+" : "D+"
  return `${sign}${Math.abs(value).toFixed(1)}`
}

export function pickDivergingColor(value: number): string {
  const abs = Math.abs(value)
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
  neutralFill?: string
}

export function resolveColor({
  scaleType,
  value,
  overrideColor,
  neutralFill = DEFAULT_NEUTRAL,
}: ResolveColorArgs): string {
  if (overrideColor) return overrideColor
  if (scaleType === "divergingRedBlue" && typeof value === "number") {
    return pickDivergingColor(value)
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
