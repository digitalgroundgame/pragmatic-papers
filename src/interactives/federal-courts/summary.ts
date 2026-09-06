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

export interface ChangeSeries {
  party: SeatParty
  /** One count per year from `startYear`, in step. */
  counts: number[]
}

export interface BenchChange {
  startYear: number
  series: ChangeSeries[]
  /** Earliest commission the history covers, which is why the chart cannot start there. */
  coverageFrom: number
}

export interface AppointmentBurst {
  /** Months since `baseYear` January. */
  month: number
  /** Index into `presidents`. */
  president: number
  count: number
}

export interface AppointmentHistory {
  baseYear: number
  presidents: { name: string; party: SeatParty }[]
  bursts: AppointmentBurst[]
}

/**
 * Upstream's own nation-wide district reconciliation. Worth carrying rather than deriving:
 * `authorized` is not the number of squares the cartogram draws, and the difference has a
 * name. A handful of courts seat more active judges than they are authorized, because roving
 * judgeships are shared across districts in the same state.
 */
export interface NationalTotals {
  authorized: number
  active: number
  vacancies: number
  overAuthorized: number
}

export interface FederalCourtsSummary {
  /** The Supreme Court's bench, in the display's own order. */
  supremeCourt: DrilldownRecord[]
  /** Region id the Supreme Court seats belong to, so a click can select it. */
  supremeCourtRegion: string | null
  cartogram: CartogramCircuit[]
  /** Judgeships by party value, plus vacancies, across every seat drawn in the cartogram. */
  districtTotals: { party: SeatParty; count: number }[]
  /** What the manifest says the national district numbers are, when it says. */
  nationalTotals: NationalTotals | null
  /** Display names for every region the summary names, so it can label without the map index. */
  labels: Record<string, string>
  /** How the sitting bench's composition moved, or null when the feed carries no history. */
  change: BenchChange | null
  /** Every appointment the history covers, bucketed by month and appointing president. */
  appointments: AppointmentHistory | null
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

function readNationalTotals(datasets: DrilldownData["datasets"]): NationalTotals | null {
  const upstream = datasets?.upstream
  if (!isRecord(upstream)) return null
  const totals = upstream.national_totals
  if (!isRecord(totals)) return null
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null
  const authorized = num(totals.authorized)
  const active = num(totals.active)
  const vacancies = num(totals.vacancies)
  const overAuthorized = num(totals.over_authorized) ?? 0
  if (authorized === null || active === null || vacancies === null) return null
  return { authorized, active, vacancies, overAuthorized }
}

interface AppointmentRow {
  commission: string
  termination: string | null
  president: string
  party: SeatParty
}

function readAppointments(
  datasets: DrilldownData["datasets"],
  presentation: DrilldownPresentation,
): AppointmentRow[] {
  const raw = datasets?.appointments
  if (!Array.isArray(raw)) return []
  const known = presentation.display.category.values.map((v) => v.value)
  const rows: AppointmentRow[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const commission = item.commission_date
    if (typeof commission !== "string" || commission.length < 7) continue
    const party = item.president_party
    const president = item.appointing_president
    rows.push({
      commission,
      termination: typeof item.termination_date === "string" ? item.termination_date : null,
      president: typeof president === "string" ? president : "",
      party: typeof party === "string" && known.includes(party) ? party : null,
    })
  }
  return rows
}

const year = (iso: string): number => Number(iso.slice(0, 4))

/**
 * How many judges appointed by each party were serving at the end of each year.
 *
 * The history only reaches back to its first commission, so a judge appointed the year before
 * it starts is invisible and the early years undercount the bench badly. The series therefore
 * begins a full judicial generation after coverage does — a federal judge's tenure runs
 * decades, so by then almost everyone still serving was commissioned inside the window — and
 * carries `coverageFrom` so the chart can say why it starts where it does.
 */
const GENERATION_YEARS = 30

function composeChange(
  rows: AppointmentRow[],
  presentation: DrilldownPresentation,
): BenchChange | null {
  if (rows.length === 0) return null
  const coverageFrom = Math.min(...rows.map((r) => year(r.commission)))
  // Departures move the composition too, so the series runs to the last change of any kind,
  // not merely to the last appointment.
  const endYear = Math.max(
    ...rows.map((r) => year(r.commission)),
    ...rows.filter((r) => r.termination !== null).map((r) => year(r.termination!)),
  )
  const startYear = coverageFrom + GENERATION_YEARS
  if (!Number.isFinite(startYear) || startYear > endYear) return null

  const parties = presentation.display.category.values.map((v) => v.value)
  const series: ChangeSeries[] = parties.map((party) => ({ party, counts: [] }))
  for (let y = startYear; y <= endYear; y++) {
    const counts = new Map<SeatParty, number>()
    for (const row of rows) {
      if (year(row.commission) > y) continue
      if (row.termination !== null && year(row.termination) <= y) continue
      counts.set(row.party, (counts.get(row.party) ?? 0) + 1)
    }
    for (const s of series) s.counts.push(counts.get(s.party) ?? 0)
  }
  return { startYear, series, coverageFrom }
}

function composeAppointments(rows: AppointmentRow[]): AppointmentHistory | null {
  if (rows.length === 0) return null
  const baseYear = Math.min(...rows.map((r) => year(r.commission)))
  const presidents: { name: string; party: SeatParty }[] = []
  const indexOf = new Map<string, number>()
  const buckets = new Map<string, AppointmentBurst>()

  for (const row of rows) {
    let index = indexOf.get(row.president)
    if (index === undefined) {
      index = presidents.length
      indexOf.set(row.president, index)
      presidents.push({ name: row.president, party: row.party })
    }
    const month = (year(row.commission) - baseYear) * 12 + (Number(row.commission.slice(5, 7)) - 1)
    if (!Number.isFinite(month) || month < 0) continue
    const key = `${month}:${index}`
    const hit = buckets.get(key)
    if (hit) hit.count += 1
    else buckets.set(key, { month, president: index, count: 1 })
  }

  const bursts = [...buckets.values()].sort(
    (a, b) => a.month - b.month || a.president - b.president,
  )
  return { baseYear, presidents, bursts }
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

  const appointmentRows = readAppointments(data.datasets, presentation)

  return {
    supremeCourt,
    supremeCourtRegion: scotusRegion,
    cartogram,
    districtTotals,
    nationalTotals: readNationalTotals(data.datasets),
    labels,
    change: composeChange(appointmentRows, presentation),
    appointments: composeAppointments(appointmentRows),
  }
}
