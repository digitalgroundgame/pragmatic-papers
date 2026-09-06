"use client"

import React, { useMemo, useState } from "react"

import { cn } from "@/utilities/utils"

import { federalCourtsPresentation } from "./presentation"
import type { AppointmentHistory, BenchChange, SeatParty } from "./summary"

const display = federalCourtsPresentation.display

export function partyColor(party: SeatParty): string {
  if (party === null) return "var(--muted-foreground)"
  return (
    display.category.values.find((v) => v.value === party)?.color ??
    display.category.other?.color ??
    "var(--muted-foreground)"
  )
}

export function partyLabel(party: SeatParty): string {
  if (party === null) return "Other"
  const hit = display.category.values.find((v) => v.value === party)
  return hit?.shortLabel ?? hit?.label ?? party
}

/** Identity is never colour alone: every series is named beside its swatch. */
function Legend({ parties }: { parties: SeatParty[] }): React.ReactElement {
  return (
    <ul
      data-chart-legend=""
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      {parties.map((party) => (
        <li key={party ?? "other"} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-xs"
            style={{ backgroundColor: partyColor(party) }}
          />
          {partyLabel(party)}
        </li>
      ))}
    </ul>
  )
}

const PLOT = { w: 720, h: 300, top: 12, right: 96, bottom: 28, left: 44 }
const inner = { w: PLOT.w - PLOT.left - PLOT.right, h: PLOT.h - PLOT.top - PLOT.bottom }

function niceTicks(max: number, count = 4): number[] {
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return ticks
}

/**
 * How the sitting bench's composition moved, as a stacked area on a zero baseline.
 *
 * Deliberately not a wiggle-baseline streamgraph: the total here is the size of the federal
 * bench, which is itself worth reading, and a floating baseline makes both the total and the
 * lower band impossible to measure.
 */
export function ChangeChart({ change }: { change: BenchChange }): React.ReactElement {
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  const years = change.series[0]?.counts.length ?? 0

  const model = useMemo(() => {
    const totals: number[] = []
    for (let i = 0; i < years; i++)
      totals.push(change.series.reduce((n, s) => n + (s.counts[i] ?? 0), 0))
    const max = Math.max(1, ...totals)
    const x = (i: number) => PLOT.left + (years <= 1 ? 0 : (i / (years - 1)) * inner.w)
    const y = (v: number) => PLOT.top + inner.h - (v / max) * inner.h

    // Stack from the baseline up, in the profile's own category order.
    const bands: { party: SeatParty; path: string; endY: number; endValue: number }[] = []
    const running = new Array(years).fill(0) as number[]
    for (const s of change.series) {
      const lower = [...running]
      for (let i = 0; i < years; i++) running[i] = (running[i] ?? 0) + (s.counts[i] ?? 0)
      const up = running.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join(" ")
      const down = lower
        .map((v, i) => `L${x(years - 1 - i)} ${y(lower[years - 1 - i] ?? 0)}`)
        .join(" ")
      bands.push({
        party: s.party,
        path: `${up} ${down} Z`,
        endY: y(running[years - 1] ?? 0),
        endValue: s.counts[years - 1] ?? 0,
      })
    }
    return { totals, max, x, y, bands }
  }, [change, years])

  if (years === 0) return <p className="text-muted-foreground py-6 text-sm">No history.</p>

  const endYear = change.startYear + years - 1
  const hoverIndex = hoverYear === null ? null : hoverYear - change.startYear

  return (
    <div>
      <Legend parties={change.series.map((s) => s.party)} />
      <svg
        data-chart-change=""
        viewBox={`0 0 ${PLOT.w} ${PLOT.h}`}
        role="img"
        aria-label="Judges in active service by appointing party, per year"
        className="mt-2 block w-full"
        onPointerLeave={() => setHoverYear(null)}
        onPointerMove={(e) => {
          const svg = e.currentTarget
          const rect = svg.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * PLOT.w
          const t = (px - PLOT.left) / inner.w
          const i = Math.round(Math.max(0, Math.min(1, t)) * (years - 1))
          setHoverYear(change.startYear + i)
        }}
      >
        {niceTicks(model.max).map((v) => (
          <g key={v}>
            <line
              x1={PLOT.left}
              x2={PLOT.left + inner.w}
              y1={model.y(v)}
              y2={model.y(v)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PLOT.left - 6}
              y={model.y(v)}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
            >
              {v}
            </text>
          </g>
        ))}

        {model.bands.map((band) => (
          <path
            key={band.party ?? "other"}
            data-chart-band={band.party ?? "other"}
            d={band.path}
            fill={partyColor(band.party)}
            // A surface-coloured hairline is the 2px gap between stacked fills.
            stroke="var(--card)"
            strokeWidth={2}
          />
        ))}

        {/* Direct labels at the endpoint: the two numbers a reader came for. */}
        {model.bands.map((band) => (
          <text
            key={`label-${band.party ?? "other"}`}
            x={PLOT.left + inner.w + 8}
            y={band.endY + 12}
            className="fill-foreground"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {band.endValue} {partyLabel(band.party)}
          </text>
        ))}

        {[change.startYear, endYear].map((y, i) => (
          <text
            key={y}
            x={i === 0 ? PLOT.left : PLOT.left + inner.w}
            y={PLOT.h - 8}
            textAnchor={i === 0 ? "start" : "end"}
            className="fill-muted-foreground"
            style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
          >
            {y}
          </text>
        ))}

        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < years && (
          <line
            x1={model.x(hoverIndex)}
            x2={model.x(hoverIndex)}
            y1={PLOT.top}
            y2={PLOT.top + inner.h}
            stroke="var(--foreground)"
            strokeWidth={1}
          />
        )}
      </svg>
      <p
        data-chart-change-readout=""
        aria-live="polite"
        className={cn("text-sm", hoverYear === null ? "text-muted-foreground" : "text-foreground")}
      >
        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < years
          ? `${hoverYear}: ${change.series
              .map((s) => `${s.counts[hoverIndex] ?? 0} ${partyLabel(s.party)}`)
              .join(" · ")}`
          : "Hover the chart for a year."}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        Judges in active service at the end of each year, by the party of the president who
        appointed them. The series starts in {change.startYear} because the appointment history
        begins in {change.coverageFrom}: earlier years would omit everyone appointed before it and
        understate the bench.
      </p>
    </div>
  )
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function monthLabel(baseYear: number, month: number): string {
  return `${MONTHS[month % 12]} ${baseYear + Math.floor(month / 12)}`
}

const SWARM = { w: 720, h: 300, top: 30, right: 8, bottom: 34, left: 8 }
const DOT = 3.1

/** One dot per appointment, stacked into the month it was made. */
export function AppointmentsChart({
  appointments,
}: {
  appointments: AppointmentHistory
}): React.ReactElement {
  const [hover, setHover] = useState<number | null>(null)

  const model = useMemo(() => {
    const months = Math.max(1, ...appointments.bursts.map((b) => b.month + 1))
    const tallest = Math.max(
      1,
      ...Object.values(
        appointments.bursts.reduce<Record<number, number>>((acc, burst) => {
          acc[burst.month] = (acc[burst.month] ?? 0) + burst.count
          return acc
        }, {}),
      ),
    )
    const plotW = SWARM.w - SWARM.left - SWARM.right
    const plotH = SWARM.h - SWARM.top - SWARM.bottom
    const step = Math.min(DOT * 2.2, plotH / tallest)
    const x = (month: number) => SWARM.left + (month / months) * plotW

    // Who was president, month by month: the president with the most commissions that month.
    // Taking each president's first and last month instead would smear a term across every
    // straggler filed under it, and would merge two non-consecutive terms into one band.
    const owner = new Map<number, number>()
    const perMonth = new Map<number, Map<number, number>>()
    for (const b of appointments.bursts) {
      if (appointments.presidents[b.president]?.party == null) continue
      const row = perMonth.get(b.month) ?? new Map<number, number>()
      row.set(b.president, (row.get(b.president) ?? 0) + b.count)
      perMonth.set(b.month, row)
    }
    for (const [month, row] of perMonth) {
      let best: number | null = null
      let bestCount = -1
      for (const [president, count] of row)
        if (count > bestCount) {
          best = president
          bestCount = count
        }
      if (best !== null) owner.set(month, best)
    }

    const terms: { president: number; from: number; to: number }[] = []
    for (const month of [...owner.keys()].sort((a, b) => a - b)) {
      const president = owner.get(month)!
      const last = terms[terms.length - 1]
      if (last && last.president === president) last.to = month
      else terms.push({ president, from: month, to: month })
    }

    const columns = new Map<number, { y: number; party: SeatParty; president: number }[]>()
    const byMonth = [...appointments.bursts].sort((one, two) => one.month - two.month)
    for (const b of byMonth) {
      const stack = columns.get(b.month) ?? []
      const party = appointments.presidents[b.president]?.party ?? null
      for (let i = 0; i < b.count; i++)
        stack.push({
          y: SWARM.top + plotH - (stack.length + 0.5) * step,
          party,
          president: b.president,
        })
      columns.set(b.month, stack)
    }
    return { months, x, columns, terms, plotH }
  }, [appointments])

  // Legend order follows the profile's own category order, with "Other" last, so it reads the
  // same here as on the map and in the bench.
  const parties = useMemo(() => {
    const order = display.category.values.map((v) => v.value)
    const seen: SeatParty[] = []
    for (const p of appointments.presidents) if (!seen.includes(p.party)) seen.push(p.party)
    return seen.sort((a, b) => {
      if (a === null) return 1
      if (b === null) return -1
      return order.indexOf(a) - order.indexOf(b)
    })
  }, [appointments])

  const hovered = hover === null ? null : model.columns.get(hover)
  const hoveredPresident =
    hovered && hovered[0] ? appointments.presidents[hovered[0].president] : null

  return (
    <div>
      <Legend parties={parties} />
      <svg
        data-chart-appointments=""
        viewBox={`0 0 ${SWARM.w} ${SWARM.h}`}
        role="img"
        aria-label="Federal judicial appointments over time, by appointing party"
        className="mt-2 block w-full"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * SWARM.w
          const plotW = SWARM.w - SWARM.left - SWARM.right
          const month = Math.round(((px - SWARM.left) / plotW) * model.months)
          // Snap to the nearest month that actually has dots: a hit target wider than a column.
          let best: number | null = null
          for (const key of model.columns.keys())
            if (best === null || Math.abs(key - month) < Math.abs(best - month)) best = key
          setHover(best)
        }}
      >
        {model.terms.map((term) => {
          const p = appointments.presidents[term.president]
          if (!p || p.name === "") return null
          const x0 = model.x(term.from)
          const x1 = model.x(term.to + 1)
          const surname = p.name.split(" ").pop() ?? p.name
          // Only label a term wide enough to hold its name. A short one keeps its coloured
          // bar and gives up its label to the hover readout rather than colliding with the
          // term beside it.
          const fits = x1 - x0 > surname.length * 5 + 4
          return (
            <g key={`${term.president}-${term.from}`}>
              <line
                x1={x0}
                x2={x1}
                y1={SWARM.top + model.plotH + 6}
                y2={SWARM.top + model.plotH + 6}
                stroke={partyColor(p.party)}
                strokeWidth={2}
              />
              {fits && (
                <text
                  x={(x0 + x1) / 2}
                  y={SWARM.top + model.plotH + 18}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 9 }}
                >
                  {surname}
                </text>
              )}
            </g>
          )
        })}

        {[...model.columns.entries()].map(([month, stack]) => (
          <g
            key={month}
            data-chart-column={month}
            opacity={hover === null || hover === month ? 1 : 0.45}
          >
            {stack.map((dot, i) => (
              <circle key={i} cx={model.x(month)} cy={dot.y} r={DOT} fill={partyColor(dot.party)} />
            ))}
          </g>
        ))}

        {[appointments.baseYear, appointments.baseYear + Math.floor(model.months / 12)].map(
          (y, i) => (
            <text
              key={y}
              x={i === 0 ? SWARM.left : SWARM.w - SWARM.right}
              y={14}
              textAnchor={i === 0 ? "start" : "end"}
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
            >
              {y}
            </text>
          ),
        )}
      </svg>
      <p
        data-chart-appointments-readout=""
        aria-live="polite"
        className={cn("text-sm", hovered ? "text-foreground" : "text-muted-foreground")}
      >
        {hovered && hoveredPresident
          ? `${monthLabel(appointments.baseYear, hover!)}: ${hovered.length} appointment${
              hovered.length === 1 ? "" : "s"
            } by ${hoveredPresident.name}`
          : "Hover the chart for a month."}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        One dot per Article III appointment the history records, stacked into the month it was
        commissioned. The bar beneath marks who was president.
      </p>
    </div>
  )
}
