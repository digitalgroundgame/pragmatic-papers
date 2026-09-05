"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/utilities/utils"

import { RecordAvatar } from "./RecordAvatar"
import { categoryOf, compareByField, fieldString, fieldTruthy } from "./recordFormat"
import type { Bench } from "./records"
import {
  arcStageHeight,
  COMPACT_METRICS,
  layoutArc,
  layoutTimeline,
  seatMetrics,
  timelineStageHeight,
  type Point,
} from "./seatLayout"
import type { DrilldownRecord, RecordDisplay } from "./types"

export type BenchMode = "timeline" | "seats"
export type SupernumeraryMode = "hide" | "show" | "include"

interface DrilldownBenchProps {
  bench: Bench
  display: RecordDisplay
  mode: BenchMode
  supernumeraryMode: SupernumeraryMode
  /** Field whose truthy records are visually marked, or null. */
  mark: string | null
  associate: DrilldownRecord | null
  cohortValue: string | null
  availableHeight: number | null
  onHover(record: DrilldownRecord | null): void
  onClick(record: DrilldownRecord): void
}

/** Seats in seat-chart order: first category, vacancies, remaining categories, then "other". */
function seatOrder(
  records: DrilldownRecord[],
  display: RecordDisplay,
): { first: DrilldownRecord[]; rest: DrilldownRecord[] } {
  const rank = (r: DrilldownRecord): number => {
    const cat = categoryOf(r, display)
    if (cat.isOther) return display.category.values.length
    return display.category.values.findIndex((v) => v.value === cat.value)
  }
  const sorted = [...records].sort(
    (a, b) => rank(a) - rank(b) || compareByField(display.order)(a, b),
  )
  return { first: sorted.filter((r) => rank(r) === 0), rest: sorted.filter((r) => rank(r) !== 0) }
}

function recordKey(r: DrilldownRecord, i: number): string {
  const id = r._id
  return typeof id === "string" || typeof id === "number" ? String(id) : `i${i}`
}

export function AssociateNode({
  record,
  display,
  onHover,
  onClick,
  inline = false,
  compact = false,
}: {
  record: DrilldownRecord
  display: RecordDisplay
  onHover(record: DrilldownRecord | null): void
  onClick(record: DrilldownRecord): void
  inline?: boolean
  compact?: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      data-drilldown-associate-node=""
      className={cn(
        "focus-visible:ring-ring/60 rounded-md outline-none focus-visible:ring-2",
        inline ? "flex items-center gap-2 text-left" : "block w-full text-center",
      )}
      onPointerEnter={() => onHover(record)}
      onPointerLeave={() => !inline && onHover(null)}
      onFocus={() => onHover(record)}
      onClick={(e) => {
        e.stopPropagation()
        onClick(record)
      }}
      aria-label={fieldString(record, display.title) ?? undefined}
    >
      <RecordAvatar
        record={record}
        display={display}
        size={inline ? "chip" : compact ? "compact" : "bench"}
        className="mx-auto"
      />
      <span
        className={cn(
          "text-foreground block leading-tight",
          inline ? "max-w-32 text-xs" : "mt-0.5 text-[11px] text-balance",
        )}
      >
        {fieldString(record, display.shortTitle) ?? fieldString(record, display.title)}
      </span>
    </button>
  )
}

/**
 * The bench: one absolutely positioned node per member, laid out as a commission-ordered
 * grid or a seat-chart semicircle. Nodes keep their identity across modes so the CSS
 * transform transition animates the re-sort. Metrics follow the stage width, so the same
 * bench fits an article column, a page-wide pane and a phone.
 */
export function DrilldownBench({
  bench,
  display,
  mode,
  supernumeraryMode,
  mark,
  associate,
  cohortValue,
  availableHeight,
  onHover,
  onClick,
}: DrilldownBenchProps): React.ReactElement {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(600)

  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver !== "function") return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    if (el.clientWidth > 0) setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const metrics = seatMetrics(width)
  const compact = metrics === COMPACT_METRICS
  const half = metrics.half
  const nodeWidth = metrics.icon + 8
  /**
   * A big bench (the 9th with its seniors folded in is 51 people) packs the arc tighter than
   * a name can be written under an icon: every label overlaps its neighbours and the chart
   * becomes unreadable. Past this many nodes the names come off and the icons speak — the
   * ring colours are the point of this view, and hovering still names anyone.
   */
  const DENSE_ARC = 20

  const all = useMemo(() => [...bench.active, ...bench.supernumerary], [bench])
  const keyOf = useMemo(() => new Map(all.map((r, i) => [r, recordKey(r, i)])), [all])

  const layout = useMemo(() => {
    const positions = new Map<DrilldownRecord, Point>()
    const hidden = new Set<DrilldownRecord>()
    let vacancies: Point[] = []
    let height: number
    let arc: ReturnType<typeof layoutArc> | null = null

    if (mode === "timeline") {
      const ordered = [...all].sort(compareByField(display.order))
      height = timelineStageHeight(ordered.length + bench.vacancies, width, metrics)
      const pts = layoutTimeline(ordered.length + bench.vacancies, width, metrics)
      ordered.forEach((r, i) => positions.set(r, pts[i]!))
      vacancies = pts.slice(ordered.length)
    } else {
      height = arcStageHeight(availableHeight)
      const filled = supernumeraryMode === "include" ? all : bench.active
      const { first, rest } = seatOrder(filled, display)
      const seatList: (DrilldownRecord | null)[] = [
        ...first,
        ...Array<null>(bench.vacancies).fill(null),
        ...rest,
      ]
      const band = supernumeraryMode === "show" ? bench.supernumerary : []
      arc = layoutArc(seatList.length, band.length, width, height, metrics)
      seatList.forEach((r, i) => {
        const p = arc!.seats[i]!
        if (r) positions.set(r, p)
        else vacancies.push(p)
      })
      band.forEach((r, i) => positions.set(r, arc!.band[i]!))
      if (supernumeraryMode === "hide") for (const r of bench.supernumerary) hidden.add(r)
    }
    return { positions, hidden, vacancies, height, arc }
  }, [all, bench, display, mode, supernumeraryMode, width, availableHeight, metrics])

  const count = useMemo(() => {
    if (mode !== "seats") return null
    const pool = supernumeraryMode === "include" ? all : bench.active
    const tally = new Map<string, { label: string; n: number }>()
    for (const r of pool) {
      const cat = categoryOf(r, display)
      const key = cat.isOther ? "__other" : cat.value
      const entry = tally.get(key) ?? { label: cat.shortLabel ?? cat.label, n: 0 }
      entry.n += 1
      tally.set(key, entry)
    }
    const total = pool.length
    const lead = [...tally.values()].sort((a, b) => b.n - a.n)[0]
    if (!lead || total === 0) return null
    const need = Math.floor(total / 2) + 1
    const supLabel = display.status?.supernumerary?.[0]
      ? (display.status.labels?.[display.status.supernumerary[0]] ?? "others")
      : "others"
    return `${lead.label} ${lead.n} of ${total} · majority ${need}${lead.n >= need ? " ✓" : " (no majority)"}${
      supernumeraryMode === "include" ? ` · incl. ${supLabel.toLowerCase()}` : ""
    }`
  }, [mode, supernumeraryMode, all, bench.active, display])

  const cohortField = display.cohort
  const arc = layout.arc
  const showLabels =
    mode !== "seats" || all.length - layout.hidden.size + bench.vacancies <= DENSE_ARC
  const at = (p: Point): React.CSSProperties => ({
    transform: `translate(${p.x - half}px, ${p.y - half}px)`,
    width: nodeWidth,
  })

  return (
    <div
      ref={stageRef}
      data-drilldown-bench=""
      data-mode={mode}
      data-density={compact ? "compact" : "regular"}
      className="relative w-full"
      style={{ height: layout.height }}
      onPointerLeave={() => onHover(null)}
    >
      {arc && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full"
          viewBox={`0 0 ${width} ${layout.height}`}
        >
          {[...arc.radii, ...(arc.band.length ? [arc.bandRadius] : [])].map((r) => (
            <path
              key={r}
              d={`M ${arc.dims.cx - r} ${arc.dims.cy} A ${r} ${r} 0 0 1 ${arc.dims.cx + r} ${arc.dims.cy}`}
              className="stroke-border fill-none"
              strokeWidth={1}
            />
          ))}
          {(() => {
            const rInner = arc.radii[0]!
            const rOuter = arc.radii[arc.radii.length - 1]!
            const meanR = arc.radii.reduce((a, b) => a + b, 0) / arc.radii.length
            const reach = (rOuter - rInner) / 2 + (half + 4) + metrics.ringGap / 2
            return (
              <line
                x1={arc.dims.cx}
                x2={arc.dims.cx}
                y1={arc.dims.cy - meanR + reach}
                y2={arc.dims.cy - meanR - reach}
                className="stroke-foreground"
                strokeWidth={1.5}
                strokeDasharray="3 4"
              />
            )
          })()}
          {count && (
            <text
              x={arc.dims.cx}
              y={arc.dims.cy + (compact ? 46 : 54)}
              textAnchor="middle"
              className={cn(
                "fill-foreground font-sans font-medium",
                compact ? "text-[11px]" : "text-xs",
              )}
              data-drilldown-count=""
            >
              {count}
            </text>
          )}
        </svg>
      )}

      {all.map((record, i) => {
        const p = layout.positions.get(record) ?? { x: width / 2, y: layout.height / 2 }
        const show = !layout.hidden.has(record)
        const cohort =
          cohortValue !== null && cohortField
            ? fieldString(record, cohortField) === cohortValue
            : false
        const flags = (display.flags ?? []).filter((f) => fieldTruthy(record, f.field))
        return (
          <button
            key={keyOf.get(record) ?? i}
            type="button"
            data-drilldown-node=""
            data-cohort={cohort ? "" : undefined}
            className={cn(
              "drilldown-node focus-visible:ring-ring/60 absolute top-0 left-0 rounded-md text-center outline-none focus-visible:ring-2",
              !show && "pointer-events-none opacity-0",
            )}
            style={at(p)}
            tabIndex={show ? 0 : -1}
            onPointerEnter={() => onHover(record)}
            onFocus={() => onHover(record)}
            onClick={(e) => {
              e.stopPropagation()
              onClick(record)
            }}
            aria-label={fieldString(record, display.title) ?? undefined}
          >
            <span className={cn("relative mx-auto block", compact ? "size-9" : "size-11")}>
              {cohort && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-1 rounded-full ring-[3px] ring-amber-400"
                />
              )}
              <RecordAvatar
                record={record}
                display={display}
                size={compact ? "compact" : "bench"}
                marked={mark !== null && fieldTruthy(record, mark)}
              />
              {flags.map((f) => (
                <span
                  key={f.field}
                  title={f.label}
                  className="bg-background text-foreground absolute -top-1 -right-1 rounded-full px-0.5 text-[10px] leading-none"
                >
                  {f.symbol ?? "•"}
                </span>
              ))}
            </span>
            {showLabels && (
              <span
                className={cn(
                  "text-foreground mt-0.5 block truncate leading-tight",
                  compact ? "text-[10px]" : "text-[11px]",
                )}
              >
                {fieldString(record, display.shortTitle) ?? fieldString(record, display.title)}
              </span>
            )}
          </button>
        )
      })}

      {layout.vacancies.map((p, i) => (
        <div
          key={`vacant-${i}`}
          data-drilldown-vacancy=""
          className="drilldown-node absolute top-0 left-0 text-center"
          style={at(p)}
        >
          <span
            className={cn(
              "border-muted-foreground/60 mx-auto block rounded-full border-2 border-dashed",
              compact ? "size-9" : "size-11",
            )}
          />
          {showLabels && (
            <span
              className={cn(
                "text-muted-foreground mt-0.5 block leading-tight",
                compact ? "text-[10px]" : "text-[11px]",
              )}
            >
              Vacant
            </span>
          )}
        </div>
      ))}

      {mode === "seats" && associate && arc && (
        <div
          data-drilldown-associate=""
          // Wider than a seat: "Circ. Justice Kavanaugh" is a title plus a surname and
          // truncating it to "Circ. Jus…" told the reader nothing.
          className="drilldown-node absolute top-0 left-0 text-center"
          style={{
            transform: `translate(${arc.dims.cx - 52}px, ${arc.dims.cy - arc.dims.r0 * 0.3 - half}px)`,
            width: 104,
          }}
        >
          <AssociateNode
            record={associate}
            display={display}
            compact={compact}
            onHover={onHover}
            onClick={onClick}
          />
        </div>
      )}
    </div>
  )
}
