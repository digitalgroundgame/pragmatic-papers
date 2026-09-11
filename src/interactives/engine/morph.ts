/**
 * Vertex morph between an overview path and its child-view twin.
 *
 * The asset contract requires each morphing shape to be exported twice from ONE
 * simplification, so the two versions share vertex count and order. That lets the view
 * interpolate point by point instead of cross-dissolving. Anything that fails the invariant
 * makes `buildMorphPairs` return null and the caller falls back to zoom + crossfade.
 *
 * Both files carry their own Y-flip, which would fight a shared interpolation, so the flip is
 * baked INTO the coordinates here (`flipYInPlace`) and the morph layer runs with no group
 * transform: t=0 reproduces the overview exactly, t=1 the child view exactly.
 */

export type Subpath = Float64Array

/** Absolute `M`/`L` only, per the contract. Anything else → null → fallback. */
export function parsePathAbs(d: string | null | undefined): Subpath[] | null {
  const subs: number[][] = []
  let cur: number[] | null = null
  let pending: number[] = []
  let cmd: string | null = null
  const flush = (): boolean => {
    if (cmd === null) return pending.length === 0
    if (cmd === "Z") return pending.length === 0
    if (pending.length === 0 || pending.length % 2) return false
    if (cmd === "M") {
      cur = []
      subs.push(cur)
    }
    if (!cur) return false
    cur.push(...pending)
    pending = []
    return true
  }
  // Letters are commands; numbers (with optional exponent) accumulate under the current one.
  const re = /([A-Za-z])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d ?? ""))) {
    if (m[1] !== undefined) {
      if (!flush()) return null
      const c = m[1].toUpperCase()
      if (m[1] !== c || (c !== "M" && c !== "L" && c !== "Z")) return null
      cmd = c
    } else {
      if (cmd === null || cmd === "Z") return null
      pending.push(+m[2]!)
    }
  }
  if (!flush()) return null
  return subs.length ? subs.map((a) => Float64Array.from(a)) : null
}

export function sameStructure(a: Subpath[] | null, b: Subpath[] | null): boolean {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i]!.length !== b[i]!.length) return false
  return true
}

/** Bake a Y-flip (screen-Y = k − geographic-Y) into the points. */
export function flipYInPlace(subs: Subpath[], k: number): Subpath[] {
  for (const s of subs) for (let i = 1; i < s.length; i += 2) s[i] = k - s[i]!
  return subs
}

export function serializePath(subs: Subpath[]): string {
  let out = ""
  for (const s of subs) {
    out += `M${Math.round(s[0]!)} ${Math.round(s[1]!)}`
    for (let i = 2; i < s.length; i += 2) out += `L${Math.round(s[i]!)} ${Math.round(s[i + 1]!)}`
  }
  return out
}

/** Writes a·(1−u) + b·u into `out`, all three sharing one structure. */
export function lerpInto(a: Subpath[], b: Subpath[], out: Subpath[], u: number): void {
  for (let s = 0; s < a.length; s++) {
    const as = a[s]!
    const bs = b[s]!
    const os = out[s]!
    for (let i = 0; i < as.length; i++) os[i] = as[i]! + (bs[i]! - as[i]!) * u
  }
}

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * The two halves of a crossing, eased at their outer ends only: `easeInOutCubic` is at rest at
 * both ends, and a half using it stops at the country — the very stop the crossing removes.
 * Cubes on both sides, so the velocities match at the handover and the join is not a seam.
 */
export const easeInCubic = (t: number): number => t * t * t
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

/**
 * How long a drill in or out takes. A crossing between two children is a multiple of it, so
 * this one number paces every transition the map makes.
 */
export const MORPH_MS = 800

/**
 * Cap on the morph's commit rate, independent of display refresh. On a high-refresh display
 * the rAF loop otherwise commits a full-map repaint every vsync, and with a high-rate mouse
 * forcing input-aligned frames Chrome's compositor convoys until the page freezes for seconds.
 * Measured upstream (court-tracker tests/freeze-hunt.mjs): uncapped froze hard every run; ≥16
 * ms survived 30-cycle runs. A no-op at 60 Hz. Do not "clean this up".
 */
export const MORPH_MIN_COMMIT_MS = 16

/** Interpolated viewBox at u. Straight-line in every component; see `zoomViewBox` for camera work. */
export function lerpViewBox(a: readonly number[], b: readonly number[], u: number): number[] {
  return a.map((v, i) => v + ((b[i] ?? v) - v) * u)
}

/**
 * A camera move from one viewBox to another, interpolated the way a zoom is seen rather than
 * the way its numbers are stored.
 *
 * A straight line through `x`, `y`, `w`, `h` measures in map units what the reader judges in
 * screen widths: halfway between 5.2M and 1.0M is 3.1M, still almost the whole country, so the
 * view stays wide and then collapses while the centre tears across at the end. The scale is
 * therefore interpolated geometrically — equal ratios in equal time — and the centre carried
 * along in proportion to its progress, which holds the pan to a steady speed on screen.
 */
/**
 * How far a geometric zoom from width `aw` to `bw` has come at `u`, as a fraction of the
 * whole move — `zoomViewBox`'s own `f`, exposed so a second interpolation riding along with
 * the camera (`frameForContent`'s content-tracking) can share the same rate instead of
 * drifting against it on raw, linear `u`.
 */
export function zoomProgress(aw: number, bw: number, u: number): number {
  if (aw <= 0 || bw <= 0) return u
  const w = aw * Math.pow(bw / aw, u)
  // Equal to `u` when there is no zoom, which is also the only case where the ratio below
  // would divide by nothing.
  return Math.abs(bw - aw) > 1e-6 ? (w - aw) / (bw - aw) : u
}

export function zoomViewBox(a: readonly number[], b: readonly number[], u: number): number[] {
  const [ax, ay, aw, ah] = a as [number, number, number, number]
  const [bx, by, bw, bh] = b as [number, number, number, number]
  if (aw <= 0 || bw <= 0 || ah <= 0 || bh <= 0) return lerpViewBox(a, b, u)
  const w = aw * Math.pow(bw / aw, u)
  const h = ah * Math.pow(bh / ah, u)
  const f = zoomProgress(aw, bw, u)
  const cx = ax + aw / 2 + (bx + bw / 2 - (ax + aw / 2)) * f
  const cy = ay + ah / 2 + (by + bh / 2 - (ay + ah / 2)) * f
  return [cx - w / 2, cy - h / 2, w, h]
}

/** The box every one of these subpaths fits inside, as a viewBox. Null if there are no points. */
export function subpathBounds(sets: readonly Subpath[][]): number[] | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const set of sets) {
    for (const sub of set) {
      for (let i = 0; i < sub.length; i += 2) {
        const x = sub[i]!
        const y = sub[i + 1]!
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 >= x0 && y1 >= y0 ? [x0, y0, x1 - x0, y1 - y0] : null
}

/**
 * The camera correction that makes a morph a flight over the map rather than the map sliding
 * up to a stationary camera.
 *
 * An overview and a child view are separately projected, so a circuit sits over a million
 * units from itself between the two. The morph translates the map bodily, and a camera
 * interpolated between a box in each frame rides along with it — right at both ends, but the
 * region never travels toward the reader. `contentFrom`/`contentTo` are the same shapes'
 * extent in each frame, so applying what the drawing has done by `u` to a camera flown in the
 * overview's own coordinates puts the flight back over the map.
 */
export function frameForContent(
  flight: readonly number[],
  contentFrom: readonly number[],
  contentTo: readonly number[],
  u: number,
): number[] {
  const [fx, fy, fw, fh] = flight as [number, number, number, number]
  const [ax, ay, aw, ah] = contentFrom as [number, number, number, number]
  const [bx, by, bw, bh] = contentTo as [number, number, number, number]
  if (aw <= 0 || ah <= 0) return [...flight]
  // What the drawing has done to itself by u: the paired shapes interpolate vertex by vertex,
  // so their extent interpolates with them.
  const s = (aw + (bw - aw) * u) / aw
  const cx = ax + aw / 2 + (bx + bw / 2 - (ax + aw / 2)) * u
  const cy = ay + ah / 2 + (by + bh / 2 - (ay + ah / 2)) * u
  const w = fw * s
  const h = fh * s
  return [
    cx + (fx + fw / 2 - (ax + aw / 2)) * s - w / 2,
    cy + (fy + fh / 2 - (ay + ah / 2)) * s - h / 2,
    w,
    h,
  ]
}

/**
 * A child view's own camera box, expressed in the overview's coordinates — where the flight
 * has to aim, since it is flown over the country and only afterwards carried into the child's
 * frame by `frameForContent`.
 */
export function pullbackViewBox(
  box: readonly number[],
  contentFrom: readonly number[],
  contentTo: readonly number[],
): number[] {
  const [ax, ay, aw, ah] = contentFrom as [number, number, number, number]
  const [bx, by, bw, bh] = contentTo as [number, number, number, number]
  if (aw <= 0 || bw <= 0) return [...box]
  const s = bw / aw
  const [x, y, w, h] = box as [number, number, number, number]
  return [
    ax + aw / 2 + (x + w / 2 - (bx + bw / 2)) / s - w / s / 2,
    ay + ah / 2 + (y + h / 2 - (by + bh / 2)) / s - h / s / 2,
    w / s,
    h / s,
  ]
}

/**
 * How to place content that belongs to one file into the frame the morph has reached. A morph
 * layer draws the overview's own shapes, the child's own shapes and the paired shapes between
 * them; only the paired ones are in the frame the camera follows, and the other two are each a
 * whole projection away. Scaling stays uniform: a fraction of a percent of slack in the
 * outlines is not worth squashing the seat blocks over.
 */
export function frameScale(content: readonly number[], blended: readonly number[]): number {
  const [, , aw, ah] = content as [number, number, number, number]
  const [, , bw, bh] = blended as [number, number, number, number]
  return aw > 0 && ah > 0 ? Math.sqrt((bw / aw) * (bh / ah)) : 1
}

export function frameTransform(content: readonly number[], blended: readonly number[]): string {
  const [ax, ay, aw, ah] = content as [number, number, number, number]
  const [bx, by, bw, bh] = blended as [number, number, number, number]
  if (aw <= 0 || ah <= 0) return ""
  const s = frameScale(content, blended)
  const tx = bx + bw / 2 - s * (ax + aw / 2)
  const ty = by + bh / 2 - s * (ay + ah / 2)
  return `translate(${tx} ${ty}) scale(${s})`
}

/** How much air a crossing leaves around the two maps it has to hold. */
const CROSS_MARGIN = 1.35

/**
 * The view a crossing passes through, in the overview's own coordinates: far enough out to
 * hold both maps and no further, since two neighbouring circuits do not need a national view
 * to travel between. Computed once from the two ends, because both halves must agree — at the
 * join they are drawing the same country. Never wider than the country itself.
 */
export function crossApexViewBox(
  from: readonly number[],
  to: readonly number[],
  country: readonly number[],
): number[] {
  const [fx, fy, fw, fh] = from as [number, number, number, number]
  const [tx, ty, tw, th] = to as [number, number, number, number]
  const [, , cw, ch] = country as [number, number, number, number]
  const x0 = Math.min(fx, tx)
  const y0 = Math.min(fy, ty)
  const x1 = Math.max(fx + fw, tx + tw)
  const y1 = Math.max(fy + fh, ty + th)
  let w = (x1 - x0) * CROSS_MARGIN
  let h = (y1 - y0) * CROSS_MARGIN
  // The country's shape, so the pull-back letterboxes the way every other view does.
  const aspect = cw / ch
  if (w / h < aspect) w = h * aspect
  else h = w / aspect
  const over = Math.max(w / cw, h / ch)
  if (over > 1) {
    w /= over
    h /= over
  }
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h]
}

export interface MorphPair {
  key: string
  start: Subpath[]
  end: Subpath[]
  work: Subpath[]
}

export interface MorphSource {
  key: string
  d: string
  inset: boolean
}

export interface MorphPairing {
  /** Shapes that interpolate. */
  pairs: MorphPair[]
  /** Overview shapes with no twin (they fade out), already flipped and serialized. */
  fadeOut: { key: string; d: string }[]
  /** Child-view shapes with no overview twin, plus the local placement of insets (fade in). */
  fadeIn: { key: string; d: string }[]
}

/**
 * Pairs every overview shape with its child-view twin by key. Returns null if anything that
 * ought to morph fails the invariant, or if nothing at all would interpolate (a parent whose
 * only child is an inset callout — crossfade is the right transition there).
 */
export function buildMorphPairs(
  overview: MorphSource[],
  local: MorphSource[],
  kOverview: number,
  kLocal: number,
): MorphPairing | null {
  const localByKey = new Map(local.map((s) => [s.key, s]))
  const pairs: MorphPair[] = []
  const fadeOut: MorphPairing["fadeOut"] = []
  const fadeIn: MorphPairing["fadeIn"] = []
  const paired = new Set<string>()

  for (const shape of overview) {
    const start = parsePathAbs(shape.d)
    if (!start) return null
    flipYInPlace(start, kOverview)
    const twin = localByKey.get(shape.key)
    if (twin && !shape.inset) {
      const end = parsePathAbs(twin.d)
      if (!sameStructure(start, end)) return null
      flipYInPlace(end!, kLocal)
      pairs.push({ key: shape.key, start, end: end!, work: start.map((s) => Float64Array.from(s)) })
      paired.add(shape.key)
      continue
    }
    fadeOut.push({ key: shape.key, d: serializePath(start) })
    if (twin) {
      // An inset lives in a different box in each file and is exempt from the vertex morph, so
      // it cannot travel — crossfade to its local placement rather than popping it in at the end.
      const localInset = parsePathAbs(twin.d)
      if (localInset)
        fadeIn.push({ key: shape.key, d: serializePath(flipYInPlace(localInset, kLocal)) })
      paired.add(shape.key)
    }
  }
  if (pairs.length === 0) return null

  for (const shape of local) {
    if (paired.has(shape.key)) continue
    const pts = parsePathAbs(shape.d)
    if (pts) fadeIn.push({ key: shape.key, d: serializePath(flipYInPlace(pts, kLocal)) })
  }
  return { pairs, fadeOut, fadeIn }
}

/** Centre of the largest sub-path's bounding box — where a seat block sits by default. */
export function largestSubpathCentre(d: string | null | undefined): [number, number] | null {
  const subs = parsePathAbs(d)
  if (!subs) return null
  let best: [number, number] | null = null
  let bestArea = -1
  for (const s of subs) {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i < s.length; i += 2) {
      const x = s[i]!
      const y = s[i + 1]!
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const area = (x1 - x0) * (y1 - y0)
    if (area > bestArea) {
      bestArea = area
      best = [(x0 + x1) / 2, (y0 + y1) / 2]
    }
  }
  return best
}
