import { BetaAnalyticsDataClient, type protos } from "@google-analytics/data"

import { env, type Integration } from "../types"

type RunReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest
type RunReportResponse = protos.google.analytics.data.v1beta.IRunReportResponse

/** One date range's figures for a page. */
export interface PageRangeFigures {
  /** Times the page was viewed (`screenPageViews`). */
  views: number
  /** People who viewed it (`totalUsers`). */
  readers: number
  /** People who scrolled to 90% of it (`scrolledUsers`, GA's enhanced measurement). */
  readersWhoFinished: number
  /** Times the query's `countEvent` was sent from the page; 0 when it named none. */
  eventCount: number
}

export interface PageReferrer {
  /** GA's session source: a hostname, `google`, or `(direct)`. */
  source: string
  views: number
}

/** What GA knows about one page, since a date and over the last 30 and 7 days. */
export interface PageFigures {
  allTime: PageRangeFigures
  last30Days: PageRangeFigures
  last7Days: PageRangeFigures
  /** The sources of the sessions that viewed it, most views first. */
  referrers: PageReferrer[]
}

export interface PageFiguresQuery {
  /** The page's path, `/articles/<slug>`. A trailing slash is counted as the same page. */
  path: string
  /** The first day to count (YYYY-MM-DD), the day it was published. */
  since: string
  /** How many referrers to return. */
  referrerLimit?: number
  /** A GA event to count on the page per range, such as `narration_play`. */
  countEvent?: string
}

export interface GoogleAnalyticsIntegration extends Integration {
  /** The GA4 property's numeric ID, or null when unset. Not a secret. */
  propertyId(): string | null
  /** The property's home in GA's web interface, for staff who have access to it. */
  reportsUrl(): string | null
  /**
   * A page's figures, in one batched call to the Data API. Throws when the connection isn't
   * configured or GA refuses the request.
   */
  pageFigures(query: PageFiguresQuery): Promise<PageFigures>
}

export interface GoogleAnalyticsOptions {
  id: string
  label: string
  /** Environment variable holding the GA4 property's numeric ID. */
  propertyEnv: string
  /** Environment variable holding the service account's email, which needs Viewer on the property. */
  emailEnv: string
  /** Environment variable holding the service account's private key (`\n` escaped is fine). */
  keyEnv: string
  /** Swapped in by tests. */
  createClient?: (credentials: {
    client_email: string
    private_key: string
  }) => Pick<BetaAnalyticsDataClient, "batchRunReports">
}

const RANGES = [
  { name: "allTime", key: "allTime" },
  { name: "last30Days", key: "last30Days" },
  { name: "last7Days", key: "last7Days" },
] as const

/** The two reports `pageFigures` asks for: the figures per range, and the top referrers. */
export function pageFiguresRequests(
  propertyId: string,
  { path, since, referrerLimit = 5, countEvent }: PageFiguresQuery,
): RunReportRequest[] {
  const dateRanges = [
    { startDate: since, endDate: "today", name: "allTime" },
    // Today plus the 29 days before it, as GA's own "Last 30 days".
    { startDate: "29daysAgo", endDate: "today", name: "last30Days" },
    { startDate: "6daysAgo", endDate: "today", name: "last7Days" },
  ]
  const pagePath = {
    filter: {
      fieldName: "pagePath",
      inListFilter: { values: [path, `${path}/`] },
    },
  }
  return [
    {
      property: `properties/${propertyId}`,
      dateRanges,
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }, { name: "scrolledUsers" }],
      dimensionFilter: pagePath,
    },
    {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: since, endDate: "today" }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: pagePath,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: referrerLimit,
    },
    ...(countEvent
      ? [
          {
            property: `properties/${propertyId}`,
            dateRanges,
            metrics: [{ name: "eventCount" }],
            dimensionFilter: {
              andGroup: {
                expressions: [
                  pagePath,
                  {
                    filter: {
                      fieldName: "eventName",
                      stringFilter: { matchType: "EXACT" as const, value: countEvent },
                    },
                  },
                ],
              },
            },
          },
        ]
      : []),
  ]
}

const toNumber = (value: string | null | undefined): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const zero = (): PageRangeFigures => ({
  views: 0,
  readers: 0,
  readersWhoFinished: 0,
  eventCount: 0,
})

/** A report's rows by the range each counts. */
function rangeRows(report: RunReportResponse | null | undefined) {
  const rangeColumn = (report?.dimensionHeaders ?? []).findIndex(
    (header) => header.name === "dateRange",
  )
  return (report?.rows ?? []).flatMap((row) => {
    const name = row.dimensionValues?.[rangeColumn === -1 ? 0 : rangeColumn]?.value
    const range = RANGES.find((r) => r.name === name)
    return range ? [{ range: range.key, metrics: row.metricValues ?? [] }] : []
  })
}

/**
 * The reports `pageFiguresRequests` describes, as figures. A range with no row had no views.
 * With several date ranges GA adds a `dateRange` dimension holding each range's name.
 */
export function toPageFigures(
  figuresReport: RunReportResponse | null | undefined,
  referrersReport: RunReportResponse | null | undefined,
  eventsReport?: RunReportResponse | null,
): PageFigures {
  const figures: PageFigures = {
    allTime: zero(),
    last30Days: zero(),
    last7Days: zero(),
    referrers: [],
  }
  for (const { range, metrics } of rangeRows(figuresReport)) {
    const [views, readers, finished] = metrics
    Object.assign(figures[range], {
      views: toNumber(views?.value),
      readers: toNumber(readers?.value),
      readersWhoFinished: toNumber(finished?.value),
    })
  }
  for (const { range, metrics } of rangeRows(eventsReport)) {
    figures[range].eventCount = toNumber(metrics[0]?.value)
  }
  for (const row of referrersReport?.rows ?? []) {
    const source = row.dimensionValues?.[0]?.value
    if (!source) continue
    figures.referrers.push({ source, views: toNumber(row.metricValues?.[0]?.value) })
  }
  return figures
}

/**
 * A GA4 property read through the Data API with a service account. The tag on the public
 * pages is separate (`NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`); this is what reads the numbers back.
 */
export function googleAnalyticsProperty(
  options: GoogleAnalyticsOptions,
): GoogleAnalyticsIntegration {
  const { propertyEnv, emailEnv, keyEnv } = options
  const createClient =
    options.createClient ??
    ((credentials) =>
      // `fallback` sends REST instead of gRPC, which production's network blocks.
      new BetaAnalyticsDataClient({ credentials, fallback: true }))

  return {
    id: options.id,
    label: options.label,
    service: "Google Analytics",
    required: [propertyEnv, emailEnv, keyEnv],
    describe: () => `google-analytics:${env(propertyEnv) ?? "(no property)"}`,
    propertyId: () => env(propertyEnv),
    reportsUrl() {
      const property = env(propertyEnv)
      return property
        ? `https://analytics.google.com/analytics/web/#/p${property}/reports/intelligenthome`
        : null
    },
    async pageFigures(query) {
      const property = env(propertyEnv)
      const email = env(emailEnv)
      const key = env(keyEnv)?.replace(/\\n/g, "\n")
      if (!property || !email || !key) {
        throw new Error(
          `Google Analytics isn't configured: set ${[propertyEnv, emailEnv, keyEnv].join(", ")}`,
        )
      }
      const client = createClient({ client_email: email, private_key: key })
      const [response] = await client.batchRunReports({
        property: `properties/${property}`,
        requests: pageFiguresRequests(property, query),
      })
      const [figuresReport, referrersReport, eventsReport] = response.reports ?? []
      return toPageFigures(figuresReport, referrersReport, eventsReport)
    },
  }
}
