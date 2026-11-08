/** @jsxImportSource @/blocks/blockImages/svg */
import type { IconNode } from "lucide"

import { jsx, type Child, type Markup } from "./svg/jsx-runtime"

/**
 * What every block's picker images are drawn with (see `./index.ts`). A thumbnail is a
 * sketch of what the block puts on the page, drawn with these shapes inside a 480×320
 * rounded card in the brand's orange and warm greys; an icon is a stock Lucide glyph in
 * grey. Each block's `picker.tsx` draws its own, its registry descriptor loads it, and the
 * `/admin/block-images/[file]` route serves them. They're JSX on the string runtime in
 * `./svg`, not React.
 */

/** A block's picker images. */
export interface BlockPicker {
  /** What the thumbnail draws inside its 480×320 card. */
  thumbnail: Markup
  /** The Lucide glyph drawn as the block's icon, from the `lucide` package. */
  icon: IconNode
}

export const BRAND = "#ff401a"
export const BRAND_MID = "#ff8466"
export const BRAND_SOFT = "#ffc9bb"
export const BRAND_WASH = "#ffe6de"
export const BACKDROP = "#fff3ef"
export const PAPER = "#ffffff"
export const EDGE = "#f1d8cf"
export const INK = "#2a211e"
export const TEXT = "#d9c7c0"
export const TEXT_DARK = "#8f7c76"
export const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
export const SERIF = "Georgia, 'Times New Roman', serif"

// --- Shapes every thumbnail draws with ---------------------------------------

/** A line of body text. */
export const Line = ({
  x,
  y,
  w,
  fill = TEXT,
}: {
  x: number
  y: number
  w: number
  fill?: string
}): Markup => <rect x={x} y={y} width={w} height={12} rx={6} fill={fill} />

/** A heading. */
export const Heading = ({
  x,
  y,
  w,
  h = 18,
}: {
  x: number
  y: number
  w: number
  h?: number
}): Markup => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={INK} />

/** A paragraph: lines of the given widths, 24px apart. */
export const Paragraph = ({ x, y, widths }: { x: number; y: number; widths: number[] }): Markup => (
  <>
    {widths.map((w, i) => (
      <Line key={i} x={x} y={y + i * 24} w={w} />
    ))}
  </>
)

export const Card = ({
  x,
  y,
  w,
  h,
  fill = PAPER,
  children,
}: {
  x: number
  y: number
  w: number
  h: number
  fill?: string
  children?: Child
}): Markup => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={16} fill={fill} stroke={EDGE} strokeWidth={2} />
    {children}
  </>
)

export const Button = ({
  x,
  y,
  w,
  h = 36,
}: {
  x: number
  y: number
  w: number
  h?: number
}): Markup => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={BRAND} />
    <rect x={x + w / 2 - w / 4} y={y + h / 2 - 4} width={w / 2} height={8} rx={4} fill={PAPER} />
  </>
)

export const Input = ({
  x,
  y,
  w,
  h = 36,
}: {
  x: number
  y: number
  w: number
  h?: number
}): Markup => (
  <rect x={x} y={y} width={w} height={h} rx={10} fill={PAPER} stroke={TEXT} strokeWidth={2} />
)

/** A photo: a sun over two hills, clipped to a rounded frame. `id` must be unique in its SVG. */
export const Picture = ({
  id,
  x,
  y,
  w,
  h,
}: {
  id: string
  x: number
  y: number
  w: number
  h: number
}): Markup => (
  <>
    <defs>
      <clipPath id={id}>
        <rect x={x} y={y} width={w} height={h} rx={12} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${id})`}>
      <rect x={x} y={y} width={w} height={h} fill={BRAND_SOFT} />
      <circle cx={x + w * 0.74} cy={y + h * 0.3} r={Math.min(w, h) * 0.12} fill={PAPER} />
      <path
        d={`M${x} ${y + h} L${x} ${y + h * 0.7} L${x + w * 0.32} ${y + h * 0.38} L${x + w * 0.62} ${y + h} Z`}
        fill={BRAND_MID}
      />
      <path
        d={`M${x + w * 0.3} ${y + h} L${x + w * 0.66} ${y + h * 0.5} L${x + w} ${y + h * 0.82} L${x + w} ${y + h} Z`}
        fill={BRAND}
      />
    </g>
  </>
)

export const Avatar = ({ cx, cy, r }: { cx: number; cy: number; r: number }): Markup => (
  <>
    <circle cx={cx} cy={cy} r={r} fill={BRAND_SOFT} />
    <circle cx={cx} cy={cy - r * 0.2} r={r * 0.36} fill={BRAND_MID} />
    <path
      d={`M${cx - r * 0.62} ${cy + r * 0.78} a${r * 0.62} ${r * 0.5} 0 0 1 ${r * 1.24} 0`}
      fill={BRAND_MID}
    />
  </>
)

/**
 * A Lucide glyph, drawn as Lucide draws it (a 24×24 grid, round caps and joins), at `size`
 * and, inside another drawing, placed at `x` and `y`.
 */
export const Glyph = ({
  icon,
  size = 24,
  color,
  strokeWidth = 2,
  x,
  y,
}: {
  icon: IconNode
  size?: number
  color: string
  strokeWidth?: number
  x?: number
  y?: number
}): Markup => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    x={x}
    y={y}
    aria-hidden="true"
  >
    {icon.map(([tag, attributes]) => jsx(tag, attributes as Record<string, unknown>))}
  </svg>
)
