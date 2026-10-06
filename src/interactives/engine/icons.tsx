import { Gavel, Landmark, Scale } from "lucide-react"
import React from "react"

import { toRoman } from "@/utilities/toRoman"
import { cn } from "@/utilities/utils"

import type { RegionIcons, RegionInfo } from "./types"

/**
 * The icons a profile may put beside a region in the rail.
 *
 * An allowlist rather than a free import: what travels from a profile through the payload is
 * a name, so this is where a name becomes a component and the set stays something a reviewer
 * can see at a glance. Add one here when a profile needs it.
 */
const ICONS = {
  scale: Scale,
  gavel: Gavel,
  landmark: Landmark,
} as const

export type IconName = keyof typeof ICONS

export function isIconName(value: unknown): value is IconName {
  return typeof value === "string" && value in ICONS
}

/**
 * The icon for one region: named for the region itself, else for the layer it is drawn on,
 * else the profile's default. A profile that declares none gets none — the rail reads fine
 * without them, and thirteen identical glyphs would say less than the names already do.
 */
export function regionIcon(
  region: Pick<RegionInfo, "id" | "layer">,
  icons: RegionIcons | undefined,
): React.ReactNode {
  if (!icons) return null
  const name =
    icons.byRegion?.[region.id] ??
    (region.layer ? icons.byLayer?.[region.layer] : undefined) ??
    icons.default
  if (!isIconName(name)) return null
  const Icon = ICONS[name]
  return <Icon aria-hidden="true" />
}

/** As wide as a glyph can be and still read: "Fed" fits the box, "SCOTUS" does not. */
const SHORT_MAX = 3

/**
 * A glyph sits in the same box an icon would, whatever it is made of, so a column of them
 * lines up and the labels beside them start at one place. Longer numerals are set smaller
 * rather than allowed to push their row out: only "VIII" ever needs the smallest size.
 */
function Glyph({ children }: { children: React.ReactNode }): React.ReactElement {
  const text = typeof children === "string" ? children : ""
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center font-semibold tracking-tight",
        text.length <= 2
          ? "text-[0.78rem]"
          : text.length === 3
            ? "text-[0.66rem]"
            : "text-[0.55rem] tracking-tighter",
      )}
    >
      {children}
    </span>
  )
}

/**
 * What stands for a region wherever there is only room for one thing: down the folded rail,
 * and beside its own name in the open one. The two are the same glyph on purpose — a rail that
 * folds to a column of symbols is only navigable if the symbol is the one the reader was
 * looking at a moment ago.
 *
 * The rail used to fold to nothing, because the alternative was thirteen identical scales with
 * no way to tell the Third from the Seventh. A numbered region can say which one it is: the
 * profile names the fact carrying its short form, a leading number in it is the ordinal, and
 * the numeral is what a circuit is called in every other setting anyway.
 *
 * Falls through to the short form itself where that fits — the D.C. Circuit is "DC" to a
 * reader, and the scale every circuit would otherwise share says only "circuit", which they
 * can already see — and to the ordinary icon for anything that is neither, which is how the
 * Supreme Court stays the building it was.
 */
export function regionGlyph(
  region: Pick<RegionInfo, "id" | "layer" | "facts">,
  icons: RegionIcons | undefined,
): React.ReactNode {
  const short = icons?.shortFact ? region.facts[icons.shortFact]?.trim() : undefined
  const ordinal = short ? Number.parseInt(short, 10) : NaN
  if (Number.isFinite(ordinal) && ordinal > 0) return <Glyph>{toRoman(ordinal)}</Glyph>
  if (short && short.length <= SHORT_MAX) return <Glyph>{short}</Glyph>
  const icon = regionIcon(region, icons)
  return icon ? <Glyph>{icon}</Glyph> : null
}
