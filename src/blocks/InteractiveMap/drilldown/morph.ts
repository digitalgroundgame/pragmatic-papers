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

export const MORPH_MS = 620

/**
 * Cap on the morph's COMMIT rate, independent of display refresh. On a high-refresh display
 * the rAF loop otherwise pushes a full-map repaint commit every vsync; combined with a
 * high-rate mouse forcing input-aligned frames, Chrome's compositor convoys until the page
 * freezes for seconds. Measured upstream (court-tracker tests/freeze-hunt.mjs): uncapped froze
 * hard every run; ≥16 ms per commit survived 30-cycle runs with no freeze. 16 is a no-op at
 * 60 Hz and lands ~48–72 fps on 120–144 Hz displays. Do not "clean this up".
 */
export const MORPH_MIN_COMMIT_MS = 16

/** Interpolated viewBox at u. */
export function lerpViewBox(a: readonly number[], b: readonly number[], u: number): number[] {
  return a.map((v, i) => v + ((b[i] ?? v) - v) * u)
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
