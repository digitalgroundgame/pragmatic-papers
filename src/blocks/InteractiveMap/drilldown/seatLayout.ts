/**
 * Seat-chart geometry: a parliament-style semicircle of authorised seats, fewest rings such
 * that neighbours keep a minimum spacing, with supernumerary members in a greyed outer band.
 * Pure functions over counts and pixel sizes; the React stage applies the positions.
 *
 * Two sets of metrics. The regular set is tuned for a wide stage (an article's full column,
 * the tracker's own 1000 px pane). A side column on an interactive page is ~400–480 px, and
 * a 29-seat bench as a four-ring dome needs ~530 px at regular size, so a narrow stage gets
 * the compact set: smaller icons, tighter rings, same algorithm.
 */

export interface SeatMetrics {
  /** Icon footprint (avatar + ring), for the node width. */
  icon: number
  /** Half the node footprint, for centring. */
  half: number
  /** Minimum centre-to-centre spacing before another ring is added. */
  minSpacing: number
  /** Radial distance between concentric rings. */
  ringGap: number
  /** Grid pitch in the timeline layout. */
  cell: number
  /** Room below the arc centre for the baseline icons' lower halves, labels and the count. */
  bottom: number
  /** Inner ring radius as a fraction of the width, and its cap. */
  r0Fraction: number
  r0Max: number
}

export const REGULAR_METRICS: SeatMetrics = {
  icon: 44,
  half: 26,
  minSpacing: 48,
  ringGap: 50,
  cell: 60,
  bottom: 68,
  r0Fraction: 0.26,
  r0Max: 132,
}

export const COMPACT_METRICS: SeatMetrics = {
  icon: 36,
  half: 22,
  minSpacing: 40,
  ringGap: 42,
  cell: 52,
  bottom: 60,
  r0Fraction: 0.24,
  r0Max: 96,
}

/** Below this stage width the compact metrics apply. */
export const COMPACT_BELOW = 560

export function seatMetrics(width: number): SeatMetrics {
  return width < COMPACT_BELOW ? COMPACT_METRICS : REGULAR_METRICS
}

/** Kept for callers and tests that predate the metrics; equal to the regular set. */
export const ICON_HALF = REGULAR_METRICS.half
export const MIN_SPACING = REGULAR_METRICS.minSpacing
export const RING_GAP = REGULAR_METRICS.ringGap
export const TIMELINE_CELL = REGULAR_METRICS.cell
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
 * nothing.
 */
export function arcDims(width: number, height: number, m: SeatMetrics = REGULAR_METRICS): ArcDims {
  const cx = width / 2
  const cy = height - m.bottom
  return { cx, cy, rMax: Math.max(60, cy - 30), r0: Math.min(width * m.r0Fraction, m.r0Max) }
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

/** Fewest rings (≤ 4) such that every ring's neighbour spacing ≥ the metrics' minimum. */
export function planRings(
  n: number,
  r0: number,
  rMax: number,
  reserveBand: boolean,
  m: SeatMetrics = REGULAR_METRICS,
): RingPlan {
  const budget = rMax - (reserveBand ? m.ringGap : 0)
  const kMax = Math.max(1, Math.min(4, n, Math.floor((budget - r0) / m.ringGap) + 1))
  for (let k = 1; k <= kMax; k++) {
    const radii = Array.from({ length: k }, (_, i) => r0 + i * m.ringGap)
    const counts = ringCounts(n, radii)
    const minSpacing = Math.min(
      ...radii.map((r, i) => (counts[i]! <= 1 ? Infinity : (Math.PI * r) / (counts[i]! - 1))),
    )
    if (minSpacing >= m.minSpacing) return { radii, counts }
  }
  const radii = Array.from({ length: kMax }, (_, i) => r0 + i * m.ringGap)
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
  metrics: SeatMetrics
}

/** Positions for `seatCount` inner-arc seats and `bandCount` outer-band members. */
export function layoutArc(
  seatCount: number,
  bandCount: number,
  width: number,
  height: number,
  m: SeatMetrics = REGULAR_METRICS,
): ArcLayout {
  const dims = arcDims(width, height, m)
  const plan = planRings(Math.max(1, seatCount), dims.r0, dims.rMax, bandCount > 0, m)
  const slots = orderedSlots(plan)
  const seats: Point[] = []
  for (let i = 0; i < seatCount; i++) {
    const s = slots[i] ?? slots[slots.length - 1]!
    seats.push(pointOnArc(dims.cx, dims.cy, s.r, s.angle))
  }
  const bandRadius = plan.radii[plan.radii.length - 1]! + m.ringGap
  const band: Point[] = []
  for (let i = 0; i < bandCount; i++) {
    const angle = Math.PI - ((i + 0.5) / bandCount) * Math.PI
    band.push(pointOnArc(dims.cx, dims.cy, bandRadius, angle))
  }
  return { seats, band, radii: plan.radii, bandRadius, dims, metrics: m }
}

export function timelineColumns(width: number, m: SeatMetrics = REGULAR_METRICS): number {
  return Math.max(1, Math.floor((width - 20) / m.cell))
}

/** Grid positions for `count` icons wrapping into rows. */
export function layoutTimeline(
  count: number,
  width: number,
  m: SeatMetrics = REGULAR_METRICS,
): Point[] {
  const cols = timelineColumns(width, m)
  const out: Point[] = []
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    out.push({
      x: 32 + c * m.cell + m.cell / 2,
      y: TIMELINE_TOP + r * (m.cell + TIMELINE_ROW_GAP),
    })
  }
  return out
}

/** Stage height that fits every timeline row (floor 220 so small benches are unchanged). */
export function timelineStageHeight(
  count: number,
  width: number,
  m: SeatMetrics = REGULAR_METRICS,
): number {
  const rows = Math.max(1, Math.ceil(count / timelineColumns(width, m)))
  return Math.max(220, TIMELINE_TOP + (rows - 1) * (m.cell + TIMELINE_ROW_GAP) + 22 + 18)
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
