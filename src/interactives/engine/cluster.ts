/**
 * Laying out the courts that have no territory.
 *
 * Most seat blocks are placed by an anchor in the map's own units, which is right for a block
 * that belongs to a shape: it moves with the coastline it sits on, at whatever size the map is
 * drawn. The Supreme Court has no coastline. Neither do the Court of International Trade, the
 * Court of Federal Claims or the Federal Circuit, and the four of them are read together — so
 * what matters is their distance from each other, not their distance from Virginia.
 *
 * A block is a constant size in CSS px and an anchor is in map units, so a gap written as an
 * anchor difference is only correct at the width it was measured at. Below it the map shrinks,
 * the blocks do not, and the four close up and overlap. The gaps here are px for that reason,
 * converted at the scale of the moment; only where the group as a whole hangs is in map units.
 *
 * Everything below is arithmetic on boxes, so it can be tested without a map.
 */

export type ClusterAlign = "left" | "center" | "right"

/** One member's rendered extent. Units are the caller's, and the gaps must match them. */
export interface ClusterBox {
  readonly id: string
  readonly width: number
  readonly height: number
}

export interface ClusterSpacing {
  /** Between members along a row. */
  readonly gap: number
  /** Between one row and the next. */
  readonly rowGap: number
  /** How a row narrower than the widest one is placed against it. */
  readonly align: ClusterAlign
}

export interface ClusterPlacement {
  /** Each member's top-left, in a frame whose origin is the group's own top-left. */
  readonly at: ReadonlyMap<string, readonly [number, number]>
  readonly width: number
  readonly height: number
}

/**
 * Place rows of boxes, top row first, each row left to right.
 *
 * Rows are as wide as they need to be and the group is as wide as its widest row; a narrower
 * row is aligned against that. Members of a row are centred on each other, so a court with
 * four seats and one with sixteen sit on the same middle rather than the same top edge.
 */
export function layoutCluster(
  rows: readonly (readonly ClusterBox[])[],
  spacing: ClusterSpacing,
): ClusterPlacement {
  const filled = rows.filter((row) => row.length > 0)
  const widths = filled.map(
    (row) => row.reduce((sum, b) => sum + b.width, 0) + spacing.gap * (row.length - 1),
  )
  const heights = filled.map((row) => row.reduce((tall, b) => Math.max(tall, b.height), 0))
  const width = widths.reduce((w, row) => Math.max(w, row), 0)
  const at = new Map<string, readonly [number, number]>()
  let y = 0
  filled.forEach((row, i) => {
    const slack = width - widths[i]!
    let x = spacing.align === "left" ? 0 : spacing.align === "right" ? slack : slack / 2
    const tall = heights[i]!
    for (const box of row) {
      at.set(box.id, [x, y + (tall - box.height) / 2])
      x += box.width + spacing.gap
    }
    y += tall + spacing.rowGap
  })
  const height = heights.reduce((h, row) => h + row, 0) + spacing.rowGap * (filled.length - 1)
  return { at, width, height: filled.length > 0 ? height : 0 }
}
