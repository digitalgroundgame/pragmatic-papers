import { afterEach, describe, expect, it, vi } from "vitest"

import {
  collectAuthorIds,
  fetchAuthorsMap,
  fetchDocsMap,
  fetchMediaMap,
} from "../fetchNarrationDocs"

function okResponse(docs: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ docs }) } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchDocsMap", () => {
  it("maps each returned doc by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([{ id: 1, n: "a" }, { id: "x" }]))
    vi.stubGlobal("fetch", fetchMock)

    const map = await fetchDocsMap("things", [1, "x"], (doc) => doc.n ?? null)

    expect(map).toEqual({ 1: "a", x: null })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/things?where[id][in][0]=1&where[id][in][1]=x&depth=0&limit=2",
    )
  })

  it("doesn't fetch when there are no ids", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    expect(await fetchDocsMap("things", [], () => null)).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("dedupes ids and fetches them 25 at a time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    const ids = Array.from({ length: 30 }, (_, i) => i)
    await fetchDocsMap("things", [...ids, ...ids], () => null)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => String(url).match(/limit=(\d+)/)?.[1])).toEqual([
      "25",
      "5",
    ])
  })

  it.each([401, 403, 500])("throws on a %i response", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }))

    await expect(fetchDocsMap("users", [1], () => null)).rejects.toThrow(
      `couldn't load users (HTTP ${status})`,
    )
  })

  it("throws when the response isn't a list of docs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ errors: [] }) }),
    )

    await expect(fetchDocsMap("users", [1], () => null)).rejects.toThrow(
      "couldn't load users (unexpected response)",
    )
  })

  it("throws when any chunk fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(okResponse([]))
        .mockResolvedValueOnce({ ok: false, status: 503 }),
    )

    const ids = Array.from({ length: 30 }, (_, i) => i)
    await expect(fetchDocsMap("media", ids, () => null)).rejects.toThrow("HTTP 503")
  })
})

describe("fetchAuthorsMap", () => {
  it("reads users' names at depth 0", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([{ id: 7, name: "Ada" }, { id: 8 }]))
    vi.stubGlobal("fetch", fetchMock)

    expect(await fetchAuthorsMap([7, 8])).toEqual({ 7: { name: "Ada" }, 8: { name: null } })
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/^\/api\/users\?.*&depth=0&/)
  })
})

describe("fetchMediaMap", () => {
  it("reads alt, caption and filename at depth 1", async () => {
    const caption = { root: { type: "root", children: [] } }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ id: 3, alt: "A cat", caption, filename: "cat.png" }]))
    vi.stubGlobal("fetch", fetchMock)

    expect(await fetchMediaMap([3])).toEqual({
      3: { alt: "A cat", caption, filename: "cat.png" },
    })
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/^\/api\/media\?.*&depth=1&/)
  })
})

describe("collectAuthorIds", () => {
  it("reads bare and populated ids, deduped", () => {
    expect(collectAuthorIds([1, "2", { id: 3 }, 1, { id: 3 }, null, { name: "x" }])).toEqual([
      1,
      "2",
      3,
    ])
  })

  it("returns nothing for a missing field", () => {
    expect(collectAuthorIds(undefined)).toEqual([])
  })
})
