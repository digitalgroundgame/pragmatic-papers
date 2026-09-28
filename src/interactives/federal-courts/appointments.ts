import { isRecord } from "@/utilities/isRecord"

import { normalizeAppointingPresident } from "./presidents"
import type { DrilldownData } from "../types"
import type { Appointment } from "./upstream"

/**
 * The appointment history, folded down to what the two charts draw: how many judges appointed
 * by each party were serving at the end of each year, and how many each president commissioned
 * in each month. A few kilobytes out of upstream's megabyte of rows, folded once when the feed
 * is read. Values only — the profile's presentation turns a party into a colour and a label.
 */

/** A seat's party in the vocabulary the rest of the profile uses, or null when vacant. */
export type SeatParty = string | null

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

/** Both foldings of the same rows, as one dataset. */
export interface AppointmentSummary {
  change: BenchChange | null
  history: AppointmentHistory | null
}

interface AppointmentRow {
  commission: string
  termination: string | null
  president: string
  party: SeatParty
}

const year = (iso: string): number => Number(iso.slice(0, 4))

function readRows(rows: Appointment[], parties: readonly string[]): AppointmentRow[] {
  const out: AppointmentRow[] = []
  for (const row of rows) {
    const commission = row.commission_date
    if (typeof commission !== "string" || commission.length < 7) continue
    out.push({
      commission,
      termination: row.termination_date,
      president: normalizeAppointingPresident(row.appointing_president) || "",
      party: parties.includes(row.president_party) ? row.president_party : null,
    })
  }
  return out
}

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

function composeChange(rows: AppointmentRow[], parties: readonly string[]): BenchChange | null {
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

function composeHistory(rows: AppointmentRow[]): AppointmentHistory | null {
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

/** The dataset one sync writes, or null when the feed carries no appointment history. */
export function aggregateAppointments(
  rows: Appointment[] | null,
  parties: readonly string[],
): AppointmentSummary | null {
  if (!rows || rows.length === 0) return null
  const parsed = readRows(rows, parties)
  const change = composeChange(parsed, parties)
  const history = composeHistory(parsed)
  return change || history ? { change, history } : null
}

// ---- reading it back ------------------------------------------------------------------------

const numbers = (v: unknown): v is number[] => Array.isArray(v) && v.every(Number.isFinite)

function readChange(v: unknown): BenchChange | null {
  if (!isRecord(v)) return null
  const { startYear, coverageFrom, series } = v
  if (!Number.isFinite(startYear) || !Number.isFinite(coverageFrom)) return null
  if (!Array.isArray(series)) return null
  const out: ChangeSeries[] = []
  for (const s of series) {
    if (!isRecord(s) || !numbers(s.counts)) return null
    out.push({ party: typeof s.party === "string" ? s.party : null, counts: s.counts })
  }
  return { startYear: startYear as number, coverageFrom: coverageFrom as number, series: out }
}

function readHistory(v: unknown): AppointmentHistory | null {
  if (!isRecord(v)) return null
  const { baseYear, presidents, bursts } = v
  if (!Number.isFinite(baseYear) || !Array.isArray(presidents) || !Array.isArray(bursts))
    return null
  const people: AppointmentHistory["presidents"] = []
  for (const p of presidents) {
    if (!isRecord(p) || typeof p.name !== "string") return null
    people.push({ name: p.name, party: typeof p.party === "string" ? p.party : null })
  }
  const out: AppointmentBurst[] = []
  for (const b of bursts) {
    if (!isRecord(b)) return null
    const { month, president, count } = b
    if (!Number.isFinite(month) || !Number.isFinite(president) || !Number.isFinite(count)) {
      return null
    }
    out.push({ month: month as number, president: president as number, count: count as number })
  }
  return { baseYear: baseYear as number, presidents: people, bursts: out }
}

/**
 * The dataset as a snapshot carries it. A snapshot written before this was folded at sync
 * time carries the raw rows instead, and reads back as nothing — the next sync replaces it.
 */
export function readAppointmentSummary(datasets: DrilldownData["datasets"]): AppointmentSummary {
  const raw = datasets?.appointments
  if (!isRecord(raw)) return { change: null, history: null }
  return { change: readChange(raw.change), history: readHistory(raw.history) }
}
