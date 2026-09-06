import { fieldString } from "@/blocks/InteractiveMap/drilldown/recordFormat"
import type { DrilldownRecord } from "@/blocks/InteractiveMap/drilldown/types"

import type { DrilldownData, DrilldownPresentation } from "../types"

/**
 * What the landing view of the Federal Courts page shows before a reader picks a circuit: the
 * Supreme Court's bench, and the district judgeships of the numbered circuits as one square
 * each. The cartogram covers only the circuits upstream lays out, so its totals sit a little
 * under the sum of every district's declared seats — count what is drawn, and say so.
 *
 * Composed on the server from the snapshot. It carries **values** — which party appointed the
 * holder of a seat, which district a square belongs to — and never a colour. The component
 * reads colours from the profile's `presentation.ts`, the same place the map's seat blocks and
 * the bench read them, so the three can never disagree.
 */

/** A seat's party in the vocabulary the rest of the profile uses, or null when vacant. */
export type SeatParty = string | null

export interface CartogramCircuit {
  id: string
  /** Where this circuit's block sits on the shared national grid, in whole cells. */
  offset: [x: number, y: number]
  rows: number
  cols: number
  /** One entry per judgeship: `[row, col, regionId, party]`. */
  cells: [row: number, col: number, region: string, party: SeatParty][]
}

export interface FederalCourtsSummary {
  /** The Supreme Court's bench, in the display's own order. */
  supremeCourt: DrilldownRecord[]
  /** Region id the Supreme Court seats belong to, so a click can select it. */
  supremeCourtRegion: string | null
  cartogram: CartogramCircuit[]
  /** Judgeships by party value, plus vacancies, across every seat drawn in the cartogram. */
  districtTotals: { party: SeatParty; count: number }[]
  /** Display names for every region the summary names, so it can label without the map index. */
  labels: Record<string, string>
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/**
 * Upstream's arrangement marks each cell "r", "d" or "vacant". Those are meanings, not colours
 * — mapping them onto the same party values the records carry is what lets the profile decide
 * how each one looks.
 */
function partyFor(code: unknown, presentation: DrilldownPresentation): SeatParty {
  if (typeof code !== "string" || code === "" || code === "vacant") return null
  const initial = code[0]!.toLowerCase()
  const hit = presentation.display.category.values.find(
    (v) => v.value[0]?.toLowerCase() === initial,
  )
  return hit ? hit.value : null
}

/**
 * Upstream places each circuit's block on a shared grid, but in drawing units rather than
 * cells: every offset is a whole multiple of one cell's pitch. Recovering that pitch (the
 * greatest common divisor of the offsets, in hundredths to stay in integers) lets the
 * component lay the grid out in plain cell units and stay out of upstream's coordinate space.
 */
function cellPitch(offsets: number[]): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  let acc = 0
  for (const value of offsets) {
    const scaled = Math.round(Math.abs(value) * 100)
    if (scaled > 0) acc = gcd(acc, scaled)
  }
  return acc > 0 ? acc / 100 : 1
}

function readCartogram(
  datasets: DrilldownData["datasets"],
  presentation: DrilldownPresentation,
): CartogramCircuit[] {
  const arrangement = datasets?.arrangement
  if (!isRecord(arrangement) || !Array.isArray(arrangement.circuits)) return []

  const rawOffsets: number[] = []
  for (const raw of arrangement.circuits)
    if (isRecord(raw) && Array.isArray(raw.offset))
      for (const n of raw.offset) if (typeof n === "number") rawOffsets.push(n)
  const pitch = cellPitch(rawOffsets)

  const out: CartogramCircuit[] = []
  for (const raw of arrangement.circuits) {
    if (!isRecord(raw) || typeof raw.circuit_id !== "string") continue
    const matrix = raw.matrix
    if (!Array.isArray(matrix) || matrix.length === 0) continue
    const offset = Array.isArray(raw.offset) ? raw.offset : [0, 0]
    const districts = isRecord(raw.cell_district) ? raw.cell_district : {}
    const parties = isRecord(raw.cell_colors) ? raw.cell_colors : {}

    const cells: CartogramCircuit["cells"] = []
    let cols = 0
    matrix.forEach((row: unknown, r: number) => {
      if (!Array.isArray(row)) return
      cols = Math.max(cols, row.length)
      row.forEach((filled: unknown, c: number) => {
        if (filled !== 1) return
        const key = `${r},${c}`
        const region = districts[key]
        if (typeof region !== "string") return
        cells.push([r, c, region, partyFor(parties[key], presentation)])
      })
    })
    if (cells.length === 0) continue

    out.push({
      id: raw.circuit_id,
      offset: [
        Math.round((Number(offset[0]) || 0) / pitch),
        Math.round((Number(offset[1]) || 0) / pitch),
      ],
      rows: matrix.length,
      cols,
      cells,
    })
  }
  return out
}

export function composeFederalCourtsSummary({
  presentation,
  data,
}: {
  presentation: DrilldownPresentation
  data: DrilldownData
}): FederalCourtsSummary {
  const cartogram = readCartogram(data.datasets, presentation)

  // The Supreme Court is the one top-level court with nothing under it: every circuit has
  // districts. Derived rather than hardcoded, so a feed that renames the id keeps working.
  const hasChildren = new Set(data.regions.map((r) => r.parentId).filter(Boolean))
  const scotusRegion = data.regions.find((r) => !r.parentId && !hasChildren.has(r.id))?.id ?? null

  const supremeCourt = scotusRegion
    ? data.records
        .filter((r) => r._region === scotusRegion && r._role !== "associate")
        .sort((a, b) => {
          const key = presentation.display.order
          const av = fieldString(a, key) ?? ""
          const bv = fieldString(b, key) ?? ""
          return av.localeCompare(bv)
        })
    : []

  const counts = new Map<SeatParty, number>()
  for (const circuit of cartogram)
    for (const [, , , party] of circuit.cells) counts.set(party, (counts.get(party) ?? 0) + 1)

  const order = presentation.display.category.values.map((v) => v.value)
  const districtTotals = [...counts.entries()]
    .map(([party, count]) => ({ party, count }))
    .sort((a, b) => {
      if (a.party === null) return 1
      if (b.party === null) return -1
      return order.indexOf(a.party) - order.indexOf(b.party)
    })

  const named = new Set<string>()
  for (const circuit of cartogram) {
    named.add(circuit.id)
    for (const [, , region] of circuit.cells) named.add(region)
  }
  if (scotusRegion) named.add(scotusRegion)
  const labels: Record<string, string> = {}
  for (const r of data.regions) if (named.has(r.id) && r.label) labels[r.id] = r.label

  return { supremeCourt, supremeCourtRegion: scotusRegion, cartogram, districtTotals, labels }
}
