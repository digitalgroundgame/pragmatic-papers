import type { ViewBox } from "./types"

/**
 * Pad the viewBox symmetrically so non-scaling strokes on shapes that touch the tight
 * bounding box are not clipped at the viewport edge. Symmetric padding keeps the centre —
 * and therefore `2·minY + height`, which the Y-flip depends on — unchanged.
 */
export const VIEWBOX_PAD_FRACTION = 0.03

export function padViewBox([x, y, w, h]: ViewBox): ViewBox {
  const pad = VIEWBOX_PAD_FRACTION * Math.max(w, h)
  return [x - pad, y - pad, w + 2 * pad, h + 2 * pad]
}

export function viewBoxAttr(vb: ViewBox): string {
  return vb.join(" ")
}

/**
 * The constant `k` such that screen-Y = k − geographic-Y. Recomputed from the viewBox
 * rather than read from the file's own transform string: several real exports shipped a
 * double-negative in that string and rendered correctly only because of this.
 */
export function flipConstant([, y, , h]: ViewBox): number {
  return 2 * y + h
}

export function flipTransform(vb: ViewBox): string {
  return `scale(1,-1) translate(0, ${-flipConstant(vb)})`
}

export const DEFAULT_VIEWBOX: ViewBox = [0, 0, 100, 100]

/**
 * Where the camera may point, given how far in it is and what it is looking at.
 *
 * `k` is how far in, where 1 is the whole box; `cx`/`cy` are what sits under the middle of the
 * frame. Both are held inside the box: pushed past an edge there is nothing to see, and a
 * middle the frame cannot hold is a number the reader's next drag would have to spend itself
 * undoing before the map moved at all.
 */
export function holdCamera(
  cam: { k: number; cx: number; cy: number },
  box: ViewBox,
  maxZoom: number,
): { k: number; cx: number; cy: number } {
  const [x, y, w, h] = box
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)
  const k = clamp(cam.k, 1, maxZoom)
  const vw = w / k
  const vh = h / k
  return {
    k,
    cx: clamp(cam.cx, x + vw / 2, x + w - vw / 2),
    cy: clamp(cam.cy, y + vh / 2, y + h - vh / 2),
  }
}

/** The box a camera puts on the element: the map's own, cut down and moved to where it points. */
export function cameraViewBox(cam: { k: number; cx: number; cy: number }, box: ViewBox): ViewBox {
  const [, , w, h] = box
  if (cam.k <= 1) return box
  const vw = w / cam.k
  const vh = h / cam.k
  return [cam.cx - vw / 2, cam.cy - vh / 2, vw, vh]
}
