"use client"

import React, { useMemo, useState } from "react"

import { RecordAvatar } from "@/blocks/InteractiveMap/drilldown/RecordAvatar"
import { fieldString } from "@/blocks/InteractiveMap/drilldown/recordFormat"
import { Segmented } from "@/blocks/InteractiveMap/drilldown/Segmented"
import { useDrilldownSelection } from "@/blocks/InteractiveMap/drilldown/selection"
import { layoutArc, REGULAR_METRICS } from "@/blocks/InteractiveMap/drilldown/seatLayout"
import type { DrilldownRecord } from "@/blocks/InteractiveMap/drilldown/types"
import { cn } from "@/utilities/utils"

import { AppointmentsChart, ChangeChart } from "./Charts"
import { federalCourtsPresentation } from "./presentation"
import type { FederalCourtsSummary, SeatParty } from "./summary"

type View = "scotus" | "districts" | "change" | "appointments"

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

const CELL = 1
const GAP = 0.12

/** Every district judgeship in the numbered circuits, one square per seat. */
function DistrictCartogram({
  circuits,
  totals,
  nationalTotals,
  labels,
}: {
  circuits: FederalCourtsSummary["cartogram"]
  totals: FederalCourtsSummary["districtTotals"]
  nationalTotals: FederalCourtsSummary["nationalTotals"]
  labels: Record<string, string>
}): React.ReactElement {
  const selection = useDrilldownSelection()
  const [hover, setHover] = useState<{ region: string; circuit: string } | null>(null)

  const box = useMemo(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const c of circuits) {
      minX = Math.min(minX, c.offset[0])
      minY = Math.min(minY, c.offset[1])
      maxX = Math.max(maxX, c.offset[0] + c.cols)
      maxY = Math.max(maxY, c.offset[1] + c.rows)
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 }
    const pad = 1
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  }, [circuits])

  if (circuits.length === 0)
    return <p className="text-muted-foreground py-6 text-center text-sm">No district layout.</p>

  return (
    <div>
      <Tally totals={totals} noun="district seats" />
      <p className="text-muted-foreground mt-0.5 text-xs">
        One square per seat on a district bench, filled or vacant, grouped into the circuit that
        hears its appeals. Pick one to open that district.
        {nationalTotals !== null && nationalTotals.overAuthorized > 0 && (
          <>
            {" "}
            {nationalTotals.authorized} of them are authorized judgeships; the other{" "}
            {nationalTotals.overAuthorized} are roving seats shared across districts in the same
            state.
          </>
        )}
      </p>
      <svg
        data-summary-cartogram=""
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        role="img"
        aria-label="District judgeships by circuit"
        className="mt-3 block w-full"
        style={{ maxHeight: "26rem" }}
        onPointerLeave={() => setHover(null)}
      >
        {circuits.map((circuit) => (
          <g key={circuit.id} data-summary-circuit={circuit.id}>
            {circuit.cells.map(([row, col, region, party]) => {
              const isHovered = hover?.region === region
              return (
                <rect
                  key={`${row},${col}`}
                  data-summary-seat={region}
                  x={circuit.offset[0] + col * CELL + GAP / 2}
                  y={circuit.offset[1] + row * CELL + GAP / 2}
                  width={CELL - GAP}
                  height={CELL - GAP}
                  rx={0.18}
                  fill={colorFor(party)}
                  stroke={isHovered ? "var(--foreground)" : "var(--background)"}
                  strokeWidth={isHovered ? 0.22 : 0.08}
                  className="cursor-pointer"
                  onPointerEnter={() => setHover({ region, circuit: circuit.id })}
                  onClick={() => selection?.select(region)}
                >
                  <title>{labels[region] ?? region}</title>
                </rect>
              )
            })}
          </g>
        ))}
        {circuits.map((circuit) => {
          const cx =
            circuit.offset[0] +
            circuit.cells.reduce((n, [, col]) => n + col, 0) / circuit.cells.length +
            0.5
          const cy =
            circuit.offset[1] +
            circuit.cells.reduce((n, [row]) => n + row, 0) / circuit.cells.length +
            0.5
          return (
            <text
              key={circuit.id}
              data-summary-circuit-label={circuit.id}
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none"
              style={{
                fontSize: 2,
                fontWeight: 700,
                fill: "var(--foreground)",
                paintOrder: "stroke",
                stroke: "var(--background)",
                strokeWidth: 0.7,
                strokeLinejoin: "round",
              }}
            >
              {(labels[circuit.id] ?? circuit.id).replace(/\s*Cir\.?$/, "")}
            </text>
          )
        })}
      </svg>
      <p
        data-summary-cartogram-hint=""
        aria-live="polite"
        className={cn(
          "mt-1 text-center text-sm",
          hover ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {hover
          ? `${labels[hover.region] ?? hover.region} · ${labels[hover.circuit] ?? hover.circuit}`
          : "Hover a seat for its district."}
      </p>
    </div>
  )
}

/**
 * The landing view: the whole federal judiciary before the reader has picked anything. Two
 * views because the Supreme Court is nine named people and the district bench is six hundred
 * seats — the same drawing cannot serve both.
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
        <Segmented<View>
          label="Show"
          value={view}
          options={[
            { value: "scotus", label: "Supreme Court" },
            { value: "districts", label: "District courts" },
            { value: "change", label: "Change" },
            { value: "appointments", label: "Appointments" },
          ]}
          onChange={setView}
        />
      </div>
      {view === "scotus" && (
        <SupremeCourt records={data.supremeCourt} regionId={data.supremeCourtRegion} />
      )}
      {view === "districts" && (
        <DistrictCartogram
          circuits={data.cartogram}
          totals={data.districtTotals}
          nationalTotals={data.nationalTotals}
          labels={data.labels}
        />
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
