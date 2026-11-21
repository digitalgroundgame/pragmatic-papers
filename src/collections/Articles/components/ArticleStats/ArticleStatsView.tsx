"use client"

import React, { useCallback, useEffect, useState } from "react"

import type { ArticleStats, GoogleAnalyticsStats } from "@/collections/Articles/stats/endpoint"
import type { ViewCounts } from "@/collections/Articles/stats/views/count"
import { CalendarClock, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { formatLongDate, formatTimeAgo } from "@/utilities/formatDate"

/** Fetches the article's stats; `refresh` asks GA again rather than reading the cache. */
export type LoadArticleStats = (refresh: boolean) => Promise<ArticleStats>

const number = new Intl.NumberFormat("en-US")
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 })

const COLUMNS = [
  { key: "last7Days", label: "Last 7 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "allTime", label: "Since publication" },
] as const

type RangeKey = (typeof COLUMNS)[number]["key"]

interface Row {
  key: string
  label: string
  value: (range: RangeKey) => number
  /** A share to show after the number, such as the readers who finished. */
  share?: (range: RangeKey) => string | null
}

/** Cells flush with the card's own padding, so every section lines up. */
const EDGE = "first:pl-0 last:pr-0"

const finishedShare = (range: PageRangeFigures): string | null =>
  range.readers > 0 ? percent.format(range.readersWhoFinished / range.readers) : null

/** The rows the figures make: our own view count first, then GA's. */
function figureRows(
  views: ViewCounts | null,
  analytics: GoogleAnalyticsStats | null,
  narration: boolean,
): Row[] {
  const rows: Row[] = []
  if (views) rows.push({ key: "views", label: "Views", value: (range) => views[range] })
  if (analytics?.status !== "ok") return rows
  const ga = (field: keyof PageRangeFigures) => (range: RangeKey) => analytics.figures[range][field]
  rows.push(
    {
      key: "gaViews",
      label: views ? "Views in Google Analytics" : "Views",
      value: ga("views"),
    },
    { key: "readers", label: "Readers", value: ga("readers") },
    {
      key: "readersWhoFinished",
      label: "Read to the end",
      value: ga("readersWhoFinished"),
      share: (range) => finishedShare(analytics.figures[range]),
    },
  )
  if (narration) rows.push({ key: "narration", label: "Narration plays", value: ga("eventCount") })
  return rows
}

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

/**
 * Above the figures, so a writer reads it before the numbers: GA misses many readers, so
 * its figures run lower than our own count, and lower than the real readership.
 */
function UndercountNotice({ counted }: { counted: boolean }): React.ReactNode {
  return (
    <Alert>
      <Info aria-hidden />
      <AlertTitle>More people read this than Google Analytics shows</AlertTitle>
      <AlertDescription>
        <p className="m-0">
          Google Analytics can&apos;t count readers who use ad blockers or privacy tools, and a lot
          of readers do.{" "}
          {counted
            ? "Views is our own count, which they don't stop, so it runs higher. Use Google Analytics for how far people read and where they came from, and to compare your articles with each other."
            : "Treat its figures as a floor, and use them to compare your articles with each other rather than as an exact count."}{" "}
          New visits can take a few hours to reach Google Analytics.
        </p>
      </AlertDescription>
    </Alert>
  )
}

/** Our count began after the article came out, so its earlier views aren't in it. */
const countStartedLate = (stats: ArticleStats): boolean =>
  Boolean(
    stats.views &&
    stats.publishedOn &&
    (stats.views.countingSince === null || stats.publishedOn < stats.views.countingSince),
  )

function CountStartedNotice({
  countingSince,
  publishedOn,
  analytics,
}: {
  countingSince: string | null
  publishedOn: string
  analytics: boolean
}): React.ReactNode {
  return (
    <Alert>
      <CalendarClock aria-hidden />
      <AlertTitle>Views only counts visits since we started counting</AlertTitle>
      <AlertDescription>
        <p className="m-0">
          {countingSince
            ? `We started counting views on ${formatLongDate(countingSince)}, and this article came out on ${formatLongDate(publishedOn)}, so visits before then aren't in it.`
            : "We've only just started counting views, so this article's earlier visits aren't in it."}
          {analytics && " Google Analytics' figures since publication include them."}
        </p>
      </AlertDescription>
    </Alert>
  )
}

function ReadersCard({
  stats,
  refreshing,
  onRefresh,
}: {
  stats: ArticleStats
  refreshing: boolean
  onRefresh: () => void
}): React.ReactNode {
  const { views, analytics } = stats
  const rows = figureRows(views, analytics, stats.narration)
  const gaOk = analytics?.status === "ok"

  return (
    <>
      {gaOk && <UndercountNotice counted={views !== null} />}
      {countStartedLate(stats) && (
        <CountStartedNotice
          countingSince={views?.countingSince ?? null}
          publishedOn={stats.publishedOn as string}
          analytics={gaOk}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle id="article-stats-readers">Readers</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length > 0 && (
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
                      const share = row.share?.(column.key)
                      return (
                        <TableCell key={column.key} className={`text-right ${EDGE}`}>
                          {number.format(row.value(column.key))}
                          {share && <span className="text-muted-foreground"> ({share})</span>}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {views ? (
            <Note>
              Views is our own count: one for each visit to the article, with no cookies and nothing
              kept about the reader.
            </Note>
          ) : (
            <Problem>Our view count couldn&apos;t be read. Try again in a moment.</Problem>
          )}
          {analytics?.status === "ok" && (
            <Note>
              The rest is from Google Analytics, updated {formatTimeAgo(analytics.fetchedAt)}.
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
          )}
          {analytics?.status === "unconfigured" && (
            <Note>
              Google Analytics isn&apos;t connected on this site, so there are no reader figures
              from it here. Only the production site counts readers there.
            </Note>
          )}
          {analytics?.status === "error" && (
            <Problem>Google Analytics couldn&apos;t be reached. Try again in a moment.</Problem>
          )}
          {analytics?.status === "ok" && analytics.throttled && (
            <Note role="status">
              Google Analytics&apos; figures were fetched less than a minute ago, so Refresh kept
              them. Try again shortly.
            </Note>
          )}
        </CardContent>
      </Card>

      {analytics?.status === "ok" && analytics.figures.referrers.length > 0 && (
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
                {analytics.figures.referrers.map((referrer) => (
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
 * An article's Stats tab: our own view count, GA's reader figures (cached for an hour, with a
 * Refresh button), its narration plays, its comments and its place in the recommendations.
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
      <ReadersCard stats={stats} refreshing={refreshing} onRefresh={() => void fetchStats(true)} />
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
