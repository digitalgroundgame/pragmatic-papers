"use client"

import React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/utilities/utils"

import { RecordAvatar } from "./RecordAvatar"
import {
  categoryOf,
  fieldString,
  fieldTruthy,
  formatDetailLine,
  initials,
  safeHref,
  statusLabel,
} from "./recordFormat"
import type { DrilldownRecord, LookupEntry, RecordDisplay } from "./types"

export interface DetailSelection {
  record: DrilldownRecord
  display: RecordDisplay
  pinned: boolean
}

/** Side tables a `portrait` line reads; absent when the payload declares none. */
export type Lookups = Record<string, Record<string, LookupEntry>>

interface DrilldownDetailProps {
  selection: DetailSelection | null
  now: Date
  lookups?: Lookups
  className?: string
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}): React.ReactNode {
  const safe = safeHref(href)
  if (!safe) return <span>{children}</span>
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:no-underline"
    >
      {children}
    </a>
  )
}

function DetailBody({
  selection,
  now,
  lookups,
}: {
  selection: DetailSelection
  now: Date
  lookups?: Lookups
}): React.ReactElement {
  const { record, display } = selection
  const name = fieldString(record, display.title) ?? "—"
  const category = categoryOf(record, display)
  const status = statusLabel(record, display)
  const flags = (display.flags ?? []).filter((f) => fieldTruthy(record, f.field))
  const lines = display.details
    .map((line) => formatDetailLine(line, record, now, lookups))
    .filter((l): l is NonNullable<typeof l> => l !== null)
  const credit = fieldString(record, display.image?.credit)
  const license = fieldString(record, display.image?.license)
  const source = fieldString(record, display.image?.source)

  return (
    <>
      <RecordAvatar record={record} display={display} size="detail" className="mx-auto" />
      <div className="text-center text-sm font-semibold">
        {name}
        {flags.map((f) => (
          <Badge key={f.field} variant="secondary" className="ml-1 align-middle">
            {f.symbol ? `${f.symbol} ` : ""}
            {f.label}
          </Badge>
        ))}
        {status && (
          <Badge variant="outline" className="text-muted-foreground ml-1 align-middle">
            {status}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ background: category.color }}
        />
        <span>{category.label}</span>
      </div>
      <dl className="space-y-0.5">
        {lines.map((l, i) => {
          if (l.kind === "link")
            return (
              <div key={i}>
                <ExternalLink href={l.href}>{l.label} ↗</ExternalLink>
              </div>
            )
          if (l.kind === "reported")
            return (
              <div key={i} className="italic">
                {l.label}
                {l.basis ? ` (${l.basis})` : ""}
                {l.source ? (
                  <>
                    {" — "}
                    <ExternalLink href={l.source}>source</ExternalLink>
                  </>
                ) : null}
              </div>
            )
          if (l.kind === "portrait")
            return (
              <div key={i} className="flex items-center gap-1.5">
                {l.label && <dt className="text-muted-foreground shrink-0">{l.label}:</dt>}
                <dd className="flex min-w-0 items-center gap-1.5">
                  {l.image && (
                    // Hotlinked, not run through the image optimiser — the same call
                    // `RecordAvatar` makes, so an archived page degrades to initials instead
                    // of a broken proxy request.
                    <Avatar className="border-border size-6 shrink-0 border">
                      <AvatarImage
                        src={l.image}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        data-drilldown-portrait=""
                      />
                      <AvatarFallback className="bg-muted text-foreground text-[9px] font-semibold">
                        {initials(l.value)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="truncate">{l.value}</span>
                </dd>
              </div>
            )
          return (
            <div key={i} className="flex gap-1">
              {l.label && <dt className="text-muted-foreground shrink-0">{l.label}:</dt>}
              <dd>{l.value}</dd>
            </div>
          )
        })}
      </dl>
      {credit && (
        <p className="text-muted-foreground mt-auto text-[10px]">
          Photo: {license ? `${license} — ` : ""}
          {credit}
          {source ? (
            <>
              {" ("}
              <ExternalLink href={source}>source</ExternalLink>
              {")"}
            </>
          ) : null}
        </p>
      )}
    </>
  )
}

/**
 * Docked panel for one record. Hover fills it and hover-out empties it again, so what is in
 * the panel is always the thing under the pointer. Reaching the panel's own links is what the
 * click is for: it pins the record until dismissed, which the empty state says in as many
 * words.
 */
export function DrilldownDetail({
  selection,
  now,
  lookups,
  className,
}: DrilldownDetailProps): React.ReactNode {
  if (!selection) return null
  return (
    <aside
      data-drilldown-detail=""
      data-pinned={selection?.pinned ? "" : undefined}
      aria-live="polite"
      className={cn(
        // A rule, not a nested card — the pane is already the card.
        "text-card-foreground flex min-h-40 w-full flex-col gap-1.5 border-t pt-3 text-xs @2xl:w-64 @2xl:shrink-0 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-3 @4xl:w-72",
        selection?.pinned ? "border-foreground" : "border-border",
        className,
      )}
    >
      {!selection ? (
        <p className="text-muted-foreground m-auto text-center">
          Hover over a member for details.
          <br />
          Click to pin.
        </p>
      ) : (
        <DetailBody selection={selection} now={now} lookups={lookups} />
      )}
    </aside>
  )
}
