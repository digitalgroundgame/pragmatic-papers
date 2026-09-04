/**
 * Seat-chart geometry: a parliament-style semicircle of authorised seats, fewest rings such
 * that neighbours keep a minimum spacing, with supernumerary members in a greyed outer band.
 * Pure functions over counts and pixel sizes; the React stage applies the positions.
 */

/** Half the icon footprint, for centring. */
export const ICON_HALF = 26
/** Minimum centre-to-centre spacing before another ring is added. */
export const MIN_SPACING = 48
/** Radial distance between concentric rings. */
export const RING_GAP = 50
export const TIMELINE_CELL = 60
export const TIMELINE_ROW_GAP = 12
export const TIMELINE_TOP = 34

export interface ArcDims {
  cx: number
  cy: number
  rMax: number
  r0: number
}

/**
 * Top-half dome hugging the stage bottom; the count text sits below the baseline, fixed
 * relative to the arc centre, so variable whitespace lives above the dome where it labels
 * nothing. The 68 px below cy hold the baseline icons' lower halves, their labels and the
 * count line.
 */
export function arcDims(width: number, height: number): ArcDims {
  const cx = width / 2
  const cy = height - 68
  return { cx, cy, rMax: Math.max(60, cy - 30), r0: Math.min(width * 0.26, 132) }
}

/** Seats per ring ∝ ring radius, so intra-ring spacing is as equal as possible. */
export function ringCounts(n: number, radii: number[]): number[] {
  const sum = radii.reduce((a, b) => a + b, 0) || 1
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / sum)))
  let diff = n - counts.reduce((a, b) => a + b, 0)
  let i = counts.length - 1
  // Bounded: if every ring already holds its 1-seat minimum and diff < 0, nothing below can
  // fire, and an unbounded loop would pin the main thread.
  let spins = counts.length * (n + 2)
  while (diff !== 0 && spins-- > 0) {
    if (diff > 0) {
      counts[i]!++
      diff--
    } else if (counts[i]! > 1) {
      counts[i]!--
      diff++
    }
    i = i > 0 ? i - 1 : counts.length - 1
  }
  return counts
}

export interface RingPlan {
  radii: number[]
  counts: number[]
}

/** Fewest rings (≤ 4) such that every ring's neighbour spacing ≥ MIN_SPACING. */
export function planRings(n: number, r0: number, rMax: number, reserveBand: boolean): RingPlan {
  const budget = rMax - (reserveBand ? RING_GAP : 0)
  const kMax = Math.max(1, Math.min(4, n, Math.floor((budget - r0) / RING_GAP) + 1))
  for (let k = 1; k <= kMax; k++) {
    const radii = Array.from({ length: k }, (_, i) => r0 + i * RING_GAP)
    const counts = ringCounts(n, radii)
    const minSpacing = Math.min(
      ...radii.map((r, i) => (counts[i]! <= 1 ? Infinity : (Math.PI * r) / (counts[i]! - 1))),
    )
    if (minSpacing >= MIN_SPACING) return { radii, counts }
  }
  const radii = Array.from({ length: kMax }, (_, i) => r0 + i * RING_GAP)
  return { radii, counts: ringCounts(n, radii) }
}

/**
 * Evenly spaced slot angles on a semicircle, endpoints included (every ring has a seat at
 * exactly 180°); a lone seat sits at 90°. A tiny single-ring bench (≤ 3) looks odd stretched
 * to the extremes, so it spreads with arc buffers instead: 2 seats at 120°/60°, 3 at
 * 135°/90°/45°.
 */
export function ringSlotAngles(count: number, buffered: boolean): number[] {
  if (count <= 1) return [Math.PI / 2]
  if (buffered)
    return Array.from({ length: count }, (_, j) => Math.PI - ((j + 1) * Math.PI) / (count + 1))
  return Array.from({ length: count }, (_, j) => Math.PI - (j * Math.PI) / (count - 1))
}

export interface Slot {
  r: number
  angle: number
  ring: number
}

/** All slots across all rings in protractor order (180° → 0°); ties break inner-first. */
export function orderedSlots({ radii, counts }: RingPlan): Slot[] {
  const buffered = radii.length === 1 && (counts[0] ?? 0) <= 3
  const slots: Slot[] = []
  radii.forEach((r, ring) =>
    ringSlotAngles(counts[ring]!, buffered).forEach((angle) => slots.push({ r, angle, ring })),
  )
  slots.sort((a, b) => b.angle - a.angle || a.ring - b.ring)
  return slots
}

export interface Point {
  x: number
  y: number
}

export function pointOnArc(cx: number, cy: number, r: number, angle: number): Point {
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) }
}

export interface ArcLayout {
  seats: Point[]
  band: Point[]
  radii: number[]
  bandRadius: number
  dims: ArcDims
}

/** Positions for `seatCount` inner-arc seats and `bandCount` outer-band members. */
export function layoutArc(
  seatCount: number,
  bandCount: number,
  width: number,
  height: number,
): ArcLayout {
  const dims = arcDims(width, height)
  const plan = planRings(Math.max(1, seatCount), dims.r0, dims.rMax, bandCount > 0)
  const slots = orderedSlots(plan)
  const seats: Point[] = []
  for (let i = 0; i < seatCount; i++) {
    const s = slots[i] ?? slots[slots.length - 1]!
    seats.push(pointOnArc(dims.cx, dims.cy, s.r, s.angle))
  }
  const bandRadius = plan.radii[plan.radii.length - 1]! + RING_GAP
  const band: Point[] = []
  for (let i = 0; i < bandCount; i++) {
    const angle = Math.PI - ((i + 0.5) / bandCount) * Math.PI
    band.push(pointOnArc(dims.cx, dims.cy, bandRadius, angle))
  }
  return { seats, band, radii: plan.radii, bandRadius, dims }
}

export function timelineColumns(width: number): number {
  return Math.max(1, Math.floor((width - 20) / TIMELINE_CELL))
}

/** Grid positions for `count` icons wrapping into rows. */
export function layoutTimeline(count: number, width: number): Point[] {
  const cols = timelineColumns(width)
  const out: Point[] = []
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    out.push({
      x: 32 + c * TIMELINE_CELL + TIMELINE_CELL / 2,
      y: TIMELINE_TOP + r * (TIMELINE_CELL + TIMELINE_ROW_GAP),
    })
  }
  return out
}

/** Stage height that fits every timeline row (floor 220 so small benches are unchanged). */
export function timelineStageHeight(count: number, width: number): number {
  const rows = Math.max(1, Math.ceil(count / timelineColumns(width)))
  return Math.max(220, TIMELINE_TOP + (rows - 1) * (TIMELINE_CELL + TIMELINE_ROW_GAP) + 22 + 18)
}

/**
 * Seat-chart stage height: as much of the pane as is free, clamped. 360 preserves the radial
 * budget the geometry was tuned at; a pane that cannot give even that shrinks to 280 (still
 * two rings for a mid-sized bench) rather than forcing the reader to scroll for the arc.
 */
export function arcStageHeight(available: number | null): number {
  if (available === null || !Number.isFinite(available) || available <= 0) return 360
  return Math.max(280, Math.min(520, Math.floor(available)))
}
