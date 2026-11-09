"use client"

import React, { useCallback, useEffect, useState } from "react"

import type { ArticleStats, GoogleAnalyticsStats } from "@/collections/Articles/stats/endpoint"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PageRangeFigures } from "@/integrations/google/analytics"
import { formatTimeAgo } from "@/utilities/formatDate"

/** Fetches the article's stats; `refresh` asks GA again rather than reading the cache. */
export type LoadArticleStats = (refresh: boolean) => Promise<ArticleStats>

const number = new Intl.NumberFormat("en-US")
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 })

const COLUMNS = [
  { key: "last7Days", label: "Last 7 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "allTime", label: "Since publication" },
] as const

interface Row {
  key: keyof PageRangeFigures
  label: string
}

const ROWS: Row[] = [
  { key: "views", label: "Views" },
  { key: "readers", label: "Readers" },
  { key: "readersWhoFinished", label: "Read to the end" },
]

const NARRATION_ROW: Row = { key: "eventCount", label: "Narration plays" }

/** Cells flush with the card's own padding, so every section lines up. */
const EDGE = "first:pl-0 last:pr-0"

const finishedShare = (range: PageRangeFigures): string | null =>
  range.readers > 0 ? percent.format(range.readersWhoFinished / range.readers) : null

const Note = ({ children, ...props }: React.ComponentProps<"p">): React.ReactNode => (
  <p className="text-muted-foreground m-0 text-sm" {...props}>
    {children}
  </p>
)

const Problem = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <p className="text-destructive m-0 text-sm" role="alert">
    {children}
  </p>
)

function ReadersCard({
  analytics,
  narration,
  refreshing,
  onRefresh,
}: {
  analytics: GoogleAnalyticsStats
  narration: boolean
  refreshing: boolean
  onRefresh: () => void
}): React.ReactNode {
  const refresh = (
    <CardAction>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
    </CardAction>
  )

  if (analytics.status === "unconfigured") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Readers</CardTitle>
        </CardHeader>
        <CardContent>
          <Note>
            Google Analytics isn&apos;t connected on this site, so there are no reader figures here.
            Only the production site counts readers.
          </Note>
        </CardContent>
      </Card>
    )
  }

  if (analytics.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Readers</CardTitle>
          {refresh}
        </CardHeader>
        <CardContent>
          <Problem>Google Analytics couldn&apos;t be reached. Try again in a moment.</Problem>
        </CardContent>
      </Card>
    )
  }

  const { figures } = analytics
  const rows = narration ? [...ROWS, NARRATION_ROW] : ROWS
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle id="article-stats-readers">Readers</CardTitle>
          {refresh}
        </CardHeader>
        <CardContent className="space-y-3">
          <Table aria-labelledby="article-stats-readers" className="tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead className={EDGE}>
                  <span className="sr-only">Figure</span>
                </TableHead>
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`text-muted-foreground text-right font-normal ${EDGE}`}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableHead scope="row" className={`font-normal ${EDGE}`}>
                    {row.label}
                  </TableHead>
                  {COLUMNS.map((column) => {
                    const range = figures[column.key]
                    const share = row.key === "readersWhoFinished" ? finishedShare(range) : null
                    return (
                      <TableCell key={column.key} className={`text-right ${EDGE}`}>
                        {number.format(range[row.key])}
                        {share && <span className="text-muted-foreground"> ({share})</span>}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Note>
            From Google Analytics, updated {formatTimeAgo(analytics.fetchedAt)}. It doesn&apos;t
            count readers who block it, and can take a few hours to catch up.
            {analytics.reportsUrl && (
              <>
                {" "}
                <a
                  href={analytics.reportsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline"
                >
                  Open Google Analytics
                </a>
              </>
            )}
          </Note>
          {analytics.throttled && (
            <Note role="status">
              These were fetched less than a minute ago, so Refresh kept them. Try again shortly.
            </Note>
          )}
        </CardContent>
      </Card>

      {figures.referrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle id="article-stats-referrers">Where readers came from</CardTitle>
          </CardHeader>
          <CardContent>
            <Table aria-labelledby="article-stats-referrers" className="tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead className={`text-muted-foreground font-normal ${EDGE}`}>
                    Source
                  </TableHead>
                  <TableHead className={`text-muted-foreground text-right font-normal ${EDGE}`}>
                    Views since publication
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {figures.referrers.map((referrer) => (
                  <TableRow key={referrer.source}>
                    <TableCell className={EDGE}>{referrer.source}</TableCell>
                    <TableCell className={`text-right ${EDGE}`}>
                      {number.format(referrer.views)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function Shell({ children }: { children: React.ReactNode }): React.ReactNode {
  return <div className="flex max-w-3xl flex-col gap-4">{children}</div>
}

/**
 * An article's Stats tab: GA's reader figures (cached for an hour, with a Refresh button),
 * its narration plays, its comments and its place in the recommendations.
 */
export function ArticleStatsView({ load }: { load: LoadArticleStats }): React.ReactNode {
  const [stats, setStats] = useState<ArticleStats | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(
    async (refresh: boolean) => {
      setFailed(false)
      if (refresh) setRefreshing(true)
      try {
        setStats(await load(refresh))
      } catch {
        setFailed(true)
      } finally {
        setRefreshing(false)
      }
    },
    [load],
  )

  useEffect(() => {
    let current = true
    load(false).then(
      (loaded) => current && setStats(loaded),
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [load])

  if (failed && !stats) {
    return (
      <Shell>
        <Problem>The stats couldn&apos;t be loaded.</Problem>
        <div>
          <Button variant="outline" size="sm" onClick={() => void fetchStats(false)}>
            Try again
          </Button>
        </div>
      </Shell>
    )
  }

  if (!stats) {
    return (
      <Shell>
        <Note role="status">Loading stats…</Note>
      </Shell>
    )
  }

  if (!stats.published) {
    return (
      <Shell>
        <Note>Stats appear once the article is published.</Note>
      </Shell>
    )
  }

  return (
    <Shell>
      {stats.analytics && (
        <ReadersCard
          analytics={stats.analytics}
          narration={stats.narration}
          refreshing={refreshing}
          onRefresh={() => void fetchStats(true)}
        />
      )}
      {failed && <Problem>Refresh failed. These are the figures from before.</Problem>}

      <Card>
        <CardContent>
          <dl className="m-0 grid gap-4">
            {stats.comments && (
              <div>
                <dt className="font-medium">
                  <a
                    href={stats.comments.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Comments
                  </a>
                </dt>
                <dd className="m-0 mt-1">
                  {number.format(stats.comments.published)} published
                  {stats.comments.held !== undefined && (
                    <>, {number.format(stats.comments.held)} held by a check</>
                  )}
                  {stats.comments.hidden !== undefined && (
                    <>, {number.format(stats.comments.hidden)} hidden</>
                  )}
                  {stats.comments.moderateUrl && (
                    <>
                      {" · "}
                      <a href={stats.comments.moderateUrl} className="underline">
                        Moderate
                      </a>
                    </>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-medium">Recommendations</dt>
              <dd className="m-0 mt-1">
                {stats.ranking
                  ? `Number ${stats.ranking.position} of the ${stats.ranking.of} articles recommended to readers`
                  : "Not among the articles recommended to readers right now"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Shell>
  )
}
