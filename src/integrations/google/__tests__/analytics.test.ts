import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { googleAnalyticsProperty, pageFiguresRequests, toPageFigures } from "../analytics"

const row = (dims: string[], metrics: string[]) => ({
  dimensionValues: dims.map((value) => ({ value })),
  metricValues: metrics.map((value) => ({ value })),
})

const figuresReport = {
  dimensionHeaders: [{ name: "dateRange" }],
  rows: [row(["allTime"], ["1200", "900", "450"]), row(["last30Days"], ["300", "250", "100"])],
}

const referrersReport = {
  dimensionHeaders: [{ name: "sessionSource" }],
  rows: [row(["google"], ["600"]), row(["(direct)"], ["400"]), row([""], ["5"])],
}

const connection = (createClient?: Parameters<typeof googleAnalyticsProperty>[0]["createClient"]) =>
  googleAnalyticsProperty({
    id: "google-analytics",
    label: "Google Analytics reports",
    propertyEnv: "GA4_PROPERTY_ID",
    emailEnv: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    keyEnv: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    createClient,
  })

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("pageFiguresRequests", () => {
  it("asks for the page's figures over three ranges and its top referrers", () => {
    const [figures, referrers] = pageFiguresRequests("123", {
      path: "/articles/a-slug",
      since: "2026-10-01",
    })
    expect(figures).toMatchObject({
      property: "properties/123",
      dateRanges: [
        { startDate: "2026-10-01", endDate: "today", name: "allTime" },
        { startDate: "29daysAgo", endDate: "today", name: "last30Days" },
        { startDate: "6daysAgo", endDate: "today", name: "last7Days" },
      ],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }, { name: "scrolledUsers" }],
    })
    // The path with and without a trailing slash is one page.
    expect(figures?.dimensionFilter?.filter?.inListFilter?.values).toEqual([
      "/articles/a-slug",
      "/articles/a-slug/",
    ])
    expect(referrers).toMatchObject({
      dateRanges: [{ startDate: "2026-10-01", endDate: "today" }],
      dimensions: [{ name: "sessionSource" }],
      limit: 5,
    })
  })
})

describe("toPageFigures", () => {
  it("reads each range by name and lists the referrers", () => {
    expect(toPageFigures(figuresReport, referrersReport)).toEqual({
      allTime: { views: 1200, readers: 900, readersWhoFinished: 450 },
      last30Days: { views: 300, readers: 250, readersWhoFinished: 100 },
      // No row: nobody read it in the last week.
      last7Days: { views: 0, readers: 0, readersWhoFinished: 0 },
      referrers: [
        { source: "google", views: 600 },
        { source: "(direct)", views: 400 },
      ],
    })
  })

  it("is all zeroes when GA sends no rows", () => {
    expect(toPageFigures({}, undefined)).toEqual({
      allTime: { views: 0, readers: 0, readersWhoFinished: 0 },
      last30Days: { views: 0, readers: 0, readersWhoFinished: 0 },
      last7Days: { views: 0, readers: 0, readersWhoFinished: 0 },
      referrers: [],
    })
  })
})

describe("googleAnalyticsProperty", () => {
  it("is configured once the property and service account are set", () => {
    const ga = connection()
    expect(integrationStatus(ga)).toMatchObject({
      configured: false,
      missing: [
        "GA4_PROPERTY_ID",
        "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      ],
    })
    expect(ga.reportsUrl()).toBeNull()

    vi.stubEnv("GA4_PROPERTY_ID", "123")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "svc@example.com")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "key")
    expect(integrationStatus(ga).configured).toBe(true)
    expect(ga.describe()).toBe("google-analytics:123")
    expect(ga.reportsUrl()).toBe(
      "https://analytics.google.com/analytics/web/#/p123/reports/intelligenthome",
    )
  })

  it("batches both reports in one call, with the key's escaped newlines restored", async () => {
    vi.stubEnv("GA4_PROPERTY_ID", "123")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "svc@example.com")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "line1\\nline2")
    const batchRunReports = vi.fn(async () => [{ reports: [figuresReport, referrersReport] }])
    const createClient = vi.fn(() => ({ batchRunReports }) as never)

    const figures = await connection(createClient).pageFigures({
      path: "/articles/a-slug",
      since: "2026-10-01",
    })

    expect(createClient).toHaveBeenCalledWith({
      client_email: "svc@example.com",
      private_key: "line1\nline2",
    })
    expect(batchRunReports).toHaveBeenCalledTimes(1)
    expect(batchRunReports).toHaveBeenCalledWith({
      property: "properties/123",
      requests: pageFiguresRequests("123", { path: "/articles/a-slug", since: "2026-10-01" }),
    })
    expect(figures.allTime.views).toBe(1200)
  })

  it("throws, naming the variables, when it isn't configured", async () => {
    await expect(
      connection().pageFigures({ path: "/articles/a", since: "2026-10-01" }),
    ).rejects.toThrow("set GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL")
  })
})
