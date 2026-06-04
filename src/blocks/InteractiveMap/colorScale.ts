export type ColorScaleType = "divergingRedBlue" | "perRegion"

const DEFAULT_NEUTRAL = "#d4d4d4"

const DIVERGING_RED_BLUE = {
  breakpoints: [1, 5, 15],
  positive: ["#cd897f", "#fd8997", "#fd5864", "#b7212c"],
  negative: ["#9499b2", "#89aefd", "#587ac9", "#22428c"],
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

export function formatValue(
  scaleType: ColorScaleType,
  value: number | null | undefined,
): string | null {
  if (typeof value !== "number") return null
  if (scaleType === "divergingRedBlue") return formatDivergingMargin(value)
  return String(value)
}
