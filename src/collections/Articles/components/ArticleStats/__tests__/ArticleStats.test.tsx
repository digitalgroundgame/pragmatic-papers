import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ArticleStats as Stats } from "@/collections/Articles/stats/endpoint"

import { ArticleStats } from ".."

let docId: number | null = 7
vi.mock("@payloadcms/ui", () => ({
  useDocumentInfo: () => ({ id: docId }),
  useConfig: () => ({ config: { routes: { api: "/api" } } }),
}))

const range = (views: number) => ({ views, readers: 4, readersWhoFinished: 1, eventCount: 0 })
const stats = (views: number): Stats => ({
  published: true,
  narration: false,
  publishedOn: "2026-11-01",
  views: { allTime: 9, last30Days: 9, last7Days: 9, countingSince: "2026-10-01" },
  analytics: {
    status: "ok",
    figures: { allTime: range(views), last30Days: range(2), last7Days: range(1), referrers: [] },
    fetchedAt: new Date().toISOString(),
    throttled: false,
    reportsUrl: null,
  },
  comments: null,
  ranking: null,
})

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  docId = 7
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe("ArticleStats", () => {
  it("loads the article's stats from its endpoint", async () => {
    fetchMock.mockResolvedValue(Response.json(stats(1234)))
    render(<ArticleStats />)

    expect(await screen.findByRole("cell", { name: "1,234" })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/articles/7/stats", {
      method: "GET",
      credentials: "include",
    })
  })

  it("posts to the refresh endpoint when Refresh is pressed", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(stats(1)))
    fetchMock.mockResolvedValueOnce(Response.json(stats(5678)))
    render(<ArticleStats />)

    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }))

    expect(await screen.findByRole("cell", { name: "5,678" })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith("/api/articles/7/stats/refresh", {
      method: "POST",
      credentials: "include",
    })
  })

  it("says the stats couldn't be loaded when the endpoint refuses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }))
    render(<ArticleStats />)

    expect(await screen.findByRole("alert")).toHaveTextContent("The stats couldn't be loaded.")
  })

  it("keeps the figures it has when Refresh fails, and says so", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(stats(1234)))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    render(<ArticleStats />)

    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refresh failed. These are the figures from before.",
    )
    expect(screen.getByRole("cell", { name: "1,234" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled()
  })

  it("loads the stats again from Try again after the first load fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    fetchMock.mockResolvedValueOnce(Response.json(stats(42)))
    render(<ArticleStats />)

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("cell", { name: "42" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith("/api/articles/7/stats", {
      method: "GET",
      credentials: "include",
    })
  })

  it("renders nothing on an article that hasn't been saved", () => {
    docId = null
    const { container } = render(<ArticleStats />)

    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
