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
