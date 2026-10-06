// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchProductionDoc, searchProductionArticles } from "../source"

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: URL) => ({
    ok: status < 400,
    status,
    json: async () => body,
  }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const requestedURL = (fetchMock: ReturnType<typeof mockFetch>) => fetchMock.mock.calls[0]![0]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("searchProductionArticles", () => {
  it("asks production for its latest articles, fetching only what the picker shows", async () => {
    const docs = [{ id: 1, title: "Housing", slug: "housing", publishedAt: "2026-05-04" }]
    const fetchMock = mockFetch({ docs })

    expect(await searchProductionArticles("")).toEqual(docs)

    const url = requestedURL(fetchMock)
    expect(url.origin + url.pathname).toBe("https://pragmaticpapers.com/api/articles")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      depth: "0",
      limit: "20",
      sort: "-publishedAt",
      "select[title]": "true",
      "select[slug]": "true",
      "select[publishedAt]": "true",
    })
  })

  it("filters by title only when there's something to search for", async () => {
    const fetchMock = mockFetch({ docs: [] })

    await searchProductionArticles("  housing  ", 5)

    const params = requestedURL(fetchMock).searchParams
    expect(params.get("where[title][like]")).toBe("housing")
    expect(params.get("limit")).toBe("5")

    fetchMock.mockClear()
    await searchProductionArticles("   ")
    expect(requestedURL(fetchMock).searchParams.has("where[title][like]")).toBe(false)
  })

  it("fails loudly when production answers with an error", async () => {
    mockFetch({}, 503)

    await expect(searchProductionArticles("housing")).rejects.toThrow(
      "Production API returned 503 for /api/articles",
    )
  })
})

describe("fetchProductionDoc", () => {
  it("reads a document by id one level deep", async () => {
    const fetchMock = mockFetch({ id: 4, name: "Ada" })

    expect(await fetchProductionDoc("users", 4)).toEqual({ id: 4, name: "Ada" })
    expect(requestedURL(fetchMock).href).toBe("https://pragmaticpapers.com/api/users/4?depth=1")
  })

  it("treats a document production can't serve as missing rather than failing the clone", async () => {
    mockFetch({}, 404)

    expect(await fetchProductionDoc("users", 4)).toBeNull()
  })
})
