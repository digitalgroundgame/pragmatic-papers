"use client"

import React, { useCallback, useEffect, useState } from "react"

import type { ArticleStats, GoogleAnalyticsStats } from "@/collections/Articles/stats/endpoint"
import type { PageRangeFigures } from "@/integrations/google/analytics"
import { formatTimeAgo } from "@/utilities/formatDate"

import "./ArticleStats.css"

/** Fetches the article's stats; `refresh` asks GA again rather than reading the cache. */
export type LoadArticleStats = (refresh: boolean) => Promise<ArticleStats>

const number = new Intl.NumberFormat("en-US")
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 })

const COLUMNS = [
  { key: "last7Days", label: "Last 7 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "allTime", label: "Since publication" },
] as const

const ROWS: { key: keyof PageRangeFigures; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "readers", label: "Readers" },
  { key: "readersWhoFinished", label: "Read to the end" },
]

const finishedShare = (range: PageRangeFigures): string | null =>
  range.readers > 0 ? percent.format(range.readersWhoFinished / range.readers) : null

function AnalyticsSection({
  analytics,
  refreshing,
  onRefresh,
}: {
  analytics: GoogleAnalyticsStats
  refreshing: boolean
  onRefresh: () => void
}): React.ReactNode {
  if (analytics.status === "unconfigured") {
    return (
      <p className="article-stats__note">
        Google Analytics isn&apos;t connected on this site, so there are no reader figures here.
        Only the production site counts readers.
      </p>
    )
  }

  const refreshButton = (
    <button
      type="button"
      className="article-stats__refresh"
      onClick={onRefresh}
      disabled={refreshing}
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  )

  if (analytics.status === "error") {
    return (
      <div className="article-stats__footer">
        <p className="article-stats__error" role="alert">
          Google Analytics couldn&apos;t be reached. Try again in a moment.
        </p>
        {refreshButton}
      </div>
    )
  }

  const { figures } = analytics
  return (
    <>
      <table className="article-stats__table">
        <caption>Readers, from Google Analytics</caption>
        <thead>
          <tr>
            <td />
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {COLUMNS.map((column) => {
                const range = figures[column.key]
                const share = row.key === "readersWhoFinished" ? finishedShare(range) : null
                return (
                  <td key={column.key}>
                    {number.format(range[row.key])}
                    {share && <span className="article-stats__share"> ({share})</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {figures.referrers.length > 0 && (
        <section className="article-stats__section" aria-labelledby="article-stats-referrers">
          <h4 id="article-stats-referrers" className="article-stats__heading">
            Where readers came from
          </h4>
          <ol className="article-stats__referrers">
            {figures.referrers.map((referrer) => (
              <li key={referrer.source}>
                <span>{referrer.source}</span>
                <span>{number.format(referrer.views)} views</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="article-stats__footer">
        <p className="article-stats__note">
          Updated {formatTimeAgo(analytics.fetchedAt)}. Google Analytics doesn&apos;t count readers
          who block it, and can take a few hours to catch up.
          {analytics.reportsUrl && (
            <>
              {" "}
              <a href={analytics.reportsUrl} target="_blank" rel="noopener noreferrer">
                Open Google Analytics
              </a>
            </>
          )}
        </p>
        {refreshButton}
      </div>
      {analytics.throttled && (
        <p className="article-stats__note" role="status">
          These were fetched less than a minute ago, so Refresh kept them. Try again shortly.
        </p>
      )}
    </>
  )
}

/**
 * An article's Stats tab: GA's reader figures (cached for an hour, with a Refresh button),
 * its comments and its place in the recommendations.
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
      <div className="article-stats">
        <p className="article-stats__error" role="alert">
          The stats couldn&apos;t be loaded.
        </p>
        <button
          type="button"
          className="article-stats__refresh"
          onClick={() => void fetchStats(false)}
        >
          Try again
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="article-stats">
        <p className="article-stats__note" role="status">
          Loading stats…
        </p>
      </div>
    )
  }

  if (!stats.published) {
    return (
      <div className="article-stats">
        <p className="article-stats__note">Stats appear once the article is published.</p>
      </div>
    )
  }

  return (
    <div className="article-stats">
      {stats.analytics && (
        <AnalyticsSection
          analytics={stats.analytics}
          refreshing={refreshing}
          onRefresh={() => void fetchStats(true)}
        />
      )}
      {failed && (
        <p className="article-stats__error" role="alert">
          Refresh failed. These are the figures from before.
        </p>
      )}

      <dl className="article-stats__facts">
        {stats.comments && (
          <div>
            <dt>
              <a href={stats.comments.url} target="_blank" rel="noopener noreferrer">
                Comments
              </a>
            </dt>
            <dd>
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
                  <a href={stats.comments.moderateUrl}>Moderate</a>
                </>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt>Recommendations</dt>
          <dd>
            {stats.ranking
              ? `Number ${stats.ranking.position} of the ${stats.ranking.of} articles recommended to readers`
              : "Not among the articles recommended to readers right now"}
          </dd>
        </div>
      </dl>
    </div>
  )
}
