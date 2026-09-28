"use client"

import React, { useMemo, useState } from "react"

import { RecordAvatar } from "@/interactives/engine/RecordAvatar"
import { fieldString } from "@/interactives/engine/recordFormat"
import { Segmented } from "@/interactives/engine/Segmented"
import { useDrilldownSelection } from "@/interactives/engine/selection"
import { layoutArc, REGULAR_METRICS } from "@/interactives/engine/seatLayout"
import type { DrilldownRecord } from "@/interactives/engine/types"

import { AppointmentsChart, ChangeChart } from "./Charts"
import { federalCourtsPresentation } from "./presentation"
import type { FederalCourtsSummary, SeatParty } from "./summary"

type View = "scotus" | "change" | "appointments"

/**
 * What the landing pane offers. The change and appointment charts are built and tested, but
 * parked: they are a screenful each, and the map and its benches are what this page is for.
 * Uncomment a line to put one back — nothing else has to change.
 */
const VIEWS: { value: View; label: string }[] = [
  { value: "scotus", label: "Supreme Court" },
  // { value: "change", label: "Change" },
  // { value: "appointments", label: "Appointments" },
]

const display = federalCourtsPresentation.display

/**
 * A wider dome than the pane's seat chart uses. Nine seats at the default inner radius sit
 * about 46px apart, which is fine for bare avatars and far too tight for a name under each;
 * raising the inner ring gives every justice room for their surname.
 */
const SCOTUS_METRICS = { ...REGULAR_METRICS, r0Fraction: 0.4, r0Max: 200, minSpacing: 70 }

/** The profile's colour for a party value; vacancies take the map's own vacant treatment. */
function colorFor(party: SeatParty): string {
  if (party === null) return "var(--background)"
  const hit = display.category.values.find((v) => v.value === party)
  return hit?.color ?? display.category.other?.color ?? "var(--muted-foreground)"
}

function shortLabelFor(party: SeatParty): string {
  if (party === null) return "Vacant"
  const hit = display.category.values.find((v) => v.value === party)
  return hit?.shortLabel ?? hit?.label ?? party
}

function Tally({
  totals,
  noun,
}: {
  totals: { party: SeatParty; count: number }[]
  noun: string
}): React.ReactElement {
  const all = totals.reduce((n, t) => n + t.count, 0)
  return (
    <p data-summary-tally="" className="text-muted-foreground text-sm">
      <span className="text-foreground font-semibold">{all}</span> {noun}
      {totals.map((t) => (
        <span key={t.party ?? "vacant"}>
          {" · "}
          <span
            aria-hidden="true"
            className="mr-1 inline-block size-2 translate-y-px rounded-xs align-baseline"
            style={{
              backgroundColor: colorFor(t.party),
              boxShadow: "inset 0 0 0 1px var(--border)",
            }}
          />
          {t.count} {shortLabelFor(t.party)}
        </span>
      ))}
    </p>
  )
}

/** The Supreme Court's bench as the same dome the pane's seat chart uses. */
function SupremeCourt({
  records,
  regionId,
}: {
  records: DrilldownRecord[]
  regionId: string | null
}): React.ReactElement {
  const selection = useDrilldownSelection()
  const width = 560
  // Tall enough for the widened dome plus the names hanging below its baseline seats.
  const height = 340
  const layout = useMemo(
    () => layoutArc(records.length, 0, width, height, SCOTUS_METRICS),
    [records.length],
  )

  const totals = useMemo(() => {
    const counts = new Map<SeatParty, number>()
    for (const r of records) {
      const value = fieldString(r, display.category.field)
      const known = display.category.values.some((v) => v.value === value)
      const party = known ? value : null
      counts.set(party, (counts.get(party) ?? 0) + 1)
    }
    return [...counts.entries()].map(([party, count]) => ({ party, count }))
  }, [records])

  if (records.length === 0)
    return <p className="text-muted-foreground py-6 text-center text-sm">No Supreme Court data.</p>

  return (
    <div>
      <Tally totals={totals} noun="seats" />
      <div
        data-summary-scotus=""
        className="relative mx-auto mt-2 w-full"
        style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}
      >
        {records.map((record, i) => {
          const point = layout.seats[i]
          if (!point) return null
          const name = fieldString(record, display.shortTitle) ?? fieldString(record, display.title)
          return (
            <button
              key={String(record._id ?? i)}
              type="button"
              data-summary-justice={String(record._id ?? i)}
              onClick={() => regionId && selection?.select(regionId)}
              title={fieldString(record, display.title) ?? undefined}
              className="focus-visible:ring-ring/60 absolute rounded-md text-center outline-none focus-visible:ring-2"
              style={{
                left: `${(point.x / width) * 100}%`,
                top: `${(point.y / height) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <RecordAvatar record={record} display={display} size="bench" className="mx-auto" />
              <span className="text-foreground mt-0.5 block text-[11px] leading-tight">{name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The landing view: the whole federal judiciary before the reader has picked anything. The
 * district benches are not drawn here — the map already gives every court a seat block, and
 * saying it twice only invited the reader to wonder which one to believe.
 */
export function FederalCourtsSummaryView({
  data,
}: {
  data: FederalCourtsSummary
}): React.ReactElement {
  const [view, setView] = useState<View>("scotus")
  return (
    <div data-summary-view={view}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl md:text-2xl">The federal bench</h2>
        {VIEWS.length > 1 && (
          <Segmented<View> label="Show" value={view} options={VIEWS} onChange={setView} />
        )}
      </div>
      {view === "scotus" && (
        <SupremeCourt records={data.supremeCourt} regionId={data.supremeCourtRegion} />
      )}
      {view === "change" &&
        (data.change ? (
          <ChangeChart change={data.change} />
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">No appointment history.</p>
        ))}
      {view === "appointments" &&
        (data.appointments ? (
          <AppointmentsChart appointments={data.appointments} />
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">No appointment history.</p>
        ))}
    </div>
  )
}
