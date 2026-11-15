"use client"

import React, { useState } from "react"

import { Button } from "@/components/ui/button"
import { formatLongDate } from "@/utilities/formatDate"

import { latestStatements, type WhipCountData } from "./model"

/** How many statements show before the reader asks for the rest. */
export const STATEMENTS_SHOWN = 8

/**
 * What members have said on the record, newest first: how the race has moved, day by day.
 * Each is shown as it was said, with no stance of its own: the count above says where each
 * member stands now. Nothing renders while the count holds no dated statement.
 */
export function LatestStatements({ data }: { data: WhipCountData }): React.ReactNode {
  const [all, setAll] = useState(false)
  const statements = latestStatements(data)
  if (statements.length === 0) return null
  const parties = new Map(data.members.map((m) => [m.name, m.party]))
  const shown = all ? statements : statements.slice(0, STATEMENTS_SHOWN)

  return (
    <section aria-labelledby="whip-count-statements" data-whip-count-statements="">
      <p className="text-brand-text font-serif text-xs font-semibold tracking-widest uppercase">
        On the record
      </p>
      <h2
        id="whip-count-statements"
        className="mt-1 font-sans text-2xl leading-tight font-semibold tracking-tight md:text-3xl"
      >
        Latest statements
      </h2>
      <ol className="divide-border border-border mt-4 max-w-3xl divide-y border-y">
        {shown.map((s) => (
          <li key={`${s.name}:${s.saidOn}:${s.source?.url ?? s.statement}`} className="py-3">
            <p className="text-sm">
              <span className="font-medium">{s.name}</span>{" "}
              <span className="text-muted-foreground">
                ({[parties.get(s.name), s.state].filter(Boolean).join("-")})
              </span>
            </p>
            <p className="mt-1">{s.statement}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              <time dateTime={s.saidOn}>{formatLongDate(`${s.saidOn}T00:00:00Z`)}</time>
              {s.source && (
                <>
                  {" · "}
                  <a href={s.source.url} rel="noopener" className="underline">
                    {s.source.label}
                  </a>
                </>
              )}
            </p>
          </li>
        ))}
      </ol>
      {statements.length > STATEMENTS_SHOWN && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${statements.length} statements`}
        </Button>
      )}
    </section>
  )
}
