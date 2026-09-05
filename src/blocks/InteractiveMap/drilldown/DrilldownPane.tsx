"use client"

import React, { useEffect, useRef, useState } from "react"

import { cn } from "@/utilities/utils"

import {
  AssociateNode,
  DrilldownBench,
  type BenchMode,
  type SupernumeraryMode,
} from "./DrilldownBench"
import { DrilldownDetail, type DetailSelection } from "./DrilldownDetail"
import { fieldString } from "./recordFormat"
import { buildBench, type RegionRecords } from "./records"
import type { DisplayFact } from "./regions"
import type { DrilldownRecord, RecordDisplay, RegionInfo } from "./types"

interface DrilldownPaneProps {
  region: RegionInfo | null
  facts: DisplayFact[]
  records: RegionRecords
  recordsState: "idle" | "loading" | "error"
  open: boolean
  stowed: boolean
  canDrill: boolean
  onDrill(): void
  onClose(): void
  onStow(stowed: boolean): void
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
}): React.ReactElement {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="border-border inline-flex overflow-hidden rounded-xs border">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "px-2 py-0.5",
              o.value === value ? "bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Slides down over the map when a region is selected and covers it fully; the stow control
 * hides it so the map can be consulted while a region stays selected. The host article never
 * reflows: the pane is absolutely positioned inside the fixed-ratio viewport.
 */
export function DrilldownPane({
  region,
  facts,
  records,
  recordsState,
  open,
  stowed,
  canDrill,
  onDrill,
  onClose,
  onStow,
}: DrilldownPaneProps): React.ReactElement {
  const [mode, setMode] = useState<BenchMode>("timeline")
  const [supernumeraryMode, setSupernumeraryMode] = useState<SupernumeraryMode>("hide")
  const [mark, setMark] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailSelection | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [now] = useState(() => new Date())

  // A new region starts with no pinned or leftover detail.
  const regionId = region?.id ?? null
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per region selection
    setDetail(null)
  }, [regionId])

  useEffect(() => {
    const el = bodyRef.current
    if (!el || typeof ResizeObserver !== "function") return
    const ro = new ResizeObserver(() => setBodyHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const display: RecordDisplay | null = records.display
  const bench = display
    ? buildBench(records.seats, display, region?.facts[display.seatsFact ?? ""])
    : null
  const associate = records.associates[0] ?? null
  const showSupernumeraryRow = mode === "seats" && (bench?.supernumerary.length ?? 0) > 0
  const supLabel = display?.status?.supernumerary?.[0]
    ? (display.status.labels?.[display.status.supernumerary[0]] ?? "Others")
    : "Others"
  const cohortValue = detail && display?.cohort ? fieldString(detail.record, display.cohort) : null

  const hoverRecord = (record: DrilldownRecord | null, recDisplay: RecordDisplay | null): void => {
    if (detail?.pinned) return
    if (record && recDisplay) setDetail({ record, display: recDisplay, pinned: false })
    // Hover-out keeps the last record up (sticky) so the panel's links stay reachable.
  }
  const clickRecord = (record: DrilldownRecord, recDisplay: RecordDisplay): void => {
    setDetail((cur) =>
      cur?.pinned && cur.record === record ? null : { record, display: recDisplay, pinned: true },
    )
  }

  const notes = (region?.notes ?? []).filter((n) => n.mode === "always" || mode === "seats")

  return (
    <section
      data-drilldown-pane=""
      data-open={open ? "" : undefined}
      data-stowed={stowed ? "" : undefined}
      aria-label={region ? `${region.label} details` : "Region details"}
      aria-hidden={!open}
      className="bg-card text-card-foreground border-border absolute inset-0 z-10 flex flex-col rounded-sm border shadow-lg"
      onClick={() => detail?.pinned && setDetail((d) => (d ? { ...d, pinned: false } : d))}
    >
      <div className="absolute top-2 right-2 z-20 flex gap-1">
        <button
          type="button"
          aria-label={stowed ? "Show details" : "Hide details, keep selection"}
          data-drilldown-stow=""
          onClick={() => onStow(!stowed)}
          className="border-border bg-card hover:bg-muted size-7 rounded-full border text-xs"
        >
          {stowed ? "▼" : "▲"}
        </button>
        <button
          type="button"
          aria-label="Close details"
          data-drilldown-close=""
          onClick={onClose}
          className="border-border bg-card hover:bg-muted size-7 rounded-full border text-sm"
        >
          ×
        </button>
      </div>

      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 pr-20">
        {region && (
          <>
            <header className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base leading-tight font-semibold">{region.label}</h3>
                {region.summary && (
                  <p className="text-muted-foreground text-xs">{region.summary}</p>
                )}
                {facts.length > 0 && (
                  <dl className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {facts.map((f) => (
                      <div key={f.key} className="flex gap-1">
                        <dt>{f.label}</dt>
                        <dd className="text-foreground font-medium">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              {associate && mode === "timeline" && (
                <div className="shrink-0">
                  <AssociateNode
                    inline
                    record={associate.record}
                    display={associate.display}
                    onHover={(r) => hoverRecord(r, associate.display)}
                    onClick={(r) => clickRecord(r, associate.display)}
                  />
                </div>
              )}
            </header>

            <div className="flex flex-wrap items-center gap-2">
              {display && (
                <Segmented<BenchMode>
                  label="View"
                  value={mode}
                  options={[
                    { value: "timeline", label: "Timeline" },
                    { value: "seats", label: "Seats" },
                  ]}
                  onChange={setMode}
                />
              )}
              {display?.marks?.length ? (
                <Segmented
                  label="Mark:"
                  value={mark ?? "__none"}
                  options={[
                    { value: "__none", label: "None" },
                    ...display.marks.map((m) => ({ value: m.field, label: m.label })),
                  ]}
                  onChange={(v) => setMark(v === "__none" ? null : v)}
                />
              ) : null}
              {canDrill && (
                <button
                  type="button"
                  data-drilldown-drill=""
                  onClick={onDrill}
                  className="text-foreground ml-auto text-xs font-semibold underline-offset-2 hover:underline"
                >
                  View {region.childrenLabel ?? "details"} →
                </button>
              )}
            </div>

            {showSupernumeraryRow && (
              <Segmented<SupernumeraryMode>
                label={`${supLabel}:`}
                value={supernumeraryMode}
                options={[
                  { value: "hide", label: "Hide" },
                  { value: "show", label: "Show" },
                  { value: "include", label: "Include" },
                ]}
                onChange={setSupernumeraryMode}
              />
            )}

            <div className="flex flex-1 flex-col gap-3 @xl:flex-row @xl:items-stretch">
              <div className="min-w-0 flex-1">
                {recordsState === "loading" && (
                  <p
                    className="text-muted-foreground py-6 text-center text-xs"
                    data-drilldown-loading=""
                  >
                    Loading…
                  </p>
                )}
                {recordsState === "error" && (
                  <p className="text-destructive py-6 text-center text-xs" data-drilldown-error="">
                    Details could not be loaded.
                  </p>
                )}
                {recordsState === "idle" && bench && display && (
                  <DrilldownBench
                    bench={bench}
                    display={display}
                    mode={mode}
                    supernumeraryMode={supernumeraryMode}
                    mark={mark}
                    associate={associate?.record ?? null}
                    cohortValue={cohortValue}
                    availableHeight={bodyHeight === null ? null : bodyHeight - 170}
                    onHover={(r) => hoverRecord(r, display)}
                    onClick={(r) => clickRecord(r, display)}
                  />
                )}
                {recordsState === "idle" && !display && (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    No records for this region.
                  </p>
                )}
                {notes.map((n, i) => (
                  <p
                    key={i}
                    className="text-muted-foreground mt-2 text-[11px] italic"
                    data-drilldown-note=""
                  >
                    {n.text}
                  </p>
                ))}
              </div>
              {display && <DrilldownDetail selection={detail} now={now} />}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
