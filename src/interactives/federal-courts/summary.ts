import { fieldString } from "@/interactives/engine/recordFormat"
import type { DrilldownRecord } from "@/interactives/engine/types"

import type { DrilldownData, DrilldownPresentation } from "../types"
import { readAppointmentSummary, type AppointmentHistory, type BenchChange } from "./appointments"

/**
 * What the landing view of the Federal Courts page shows before a reader picks a circuit: the
 * Supreme Court's bench, and how the whole bench has moved. The district judgeships are the
 * map's job — it draws a seat block for every court — so the summary does not draw them twice.
 *
 * Composed on the server from the snapshot. It carries **values** — which party appointed the
 * holder of a seat, which district a square belongs to — and never a colour. The component
 * reads colours from the profile's `presentation.ts`, the same place the map's seat blocks and
 * the bench read them, so the three can never disagree.
 *
 * The bench history arrives already folded (`appointments.ts`, at sync time); what is left to
 * do per request is pick out the Supreme Court's own bench.
 */

export type {
  AppointmentBurst,
  AppointmentHistory,
  BenchChange,
  ChangeSeries,
  SeatParty,
} from "./appointments"

export interface FederalCourtsSummary {
  /** The Supreme Court's bench, in the display's own order. */
  supremeCourt: DrilldownRecord[]
  /** Region id the Supreme Court seats belong to, so a click can select it. */
  supremeCourtRegion: string | null
  /** How the sitting bench's composition moved, or null when the feed carries no history. */
  change: BenchChange | null
  /** Every appointment the history covers, bucketed by month and appointing president. */
  appointments: AppointmentHistory | null
}

export function composeFederalCourtsSummary({
  presentation,
  data,
}: {
  presentation: DrilldownPresentation
  data: DrilldownData
}): FederalCourtsSummary {
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

  const { change, history } = readAppointmentSummary(data.datasets)

  return {
    supremeCourt,
    supremeCourtRegion: scotusRegion,
    change,
    appointments: history,
  }
}
