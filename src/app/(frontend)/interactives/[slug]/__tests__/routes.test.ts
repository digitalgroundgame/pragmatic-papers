// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { load, draft } = vi.hoisted(() => ({
  load: {
    queryInteractiveBySlug: vi.fn(),
    loadInteractiveSearchIndex: vi.fn(),
    loadInteractiveRegion: vi.fn(),
    loadInteractiveGeometry: vi.fn(),
    loadInteractiveGeometryHash: vi.fn(),
  },
  draft: { isEnabled: false },
}))

vi.mock("@/interactives/load", () => load)
vi.mock("next/headers", () => ({ draftMode: async () => draft }))

import { GET as getGeometry } from "../regions/[regionId]/geometry/[hash]/route"
import { GET as getRegion } from "../regions/[regionId]/route"
import { GET as getSearch } from "../search/route"

const request = new Request("http://localhost/")
const args = <T>(params: T) => ({ params: Promise.resolve(params) })
const interactive = { id: 5, slug: "courts" }

const PUBLIC = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"

async function expectNotFound(res: Response): Promise<void> {
  expect(res.status).toBe(404)
  await expect(res.json()).resolves.toEqual({ error: "not found" })
}

beforeEach(() => {
  vi.clearAllMocks()
  draft.isEnabled = false
  load.queryInteractiveBySlug.mockResolvedValue(interactive)
})

describe("GET /interactives/[slug]/search", () => {
  const index = { entries: [{ id: "m1", title: "Judge Moed" }] }

  it("404s an unknown slug without composing anything", async () => {
    load.queryInteractiveBySlug.mockResolvedValue(null)
    await expectNotFound(await getSearch(request, args({ slug: "nope" })))
    expect(load.loadInteractiveSearchIndex).not.toHaveBeenCalled()
  })

  it("404s an interactive with no snapshot to search", async () => {
    load.loadInteractiveSearchIndex.mockResolvedValue(null)
    await expectNotFound(await getSearch(request, args({ slug: "courts" })))
  })

  it("serves the index as JSON a CDN may hold for an hour", async () => {
    load.loadInteractiveSearchIndex.mockResolvedValue(index)
    const res = await getSearch(request, args({ slug: "courts" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8")
    expect(res.headers.get("Cache-Control")).toBe(PUBLIC)
    await expect(res.json()).resolves.toEqual(index)
    expect(load.loadInteractiveSearchIndex).toHaveBeenCalledWith(interactive)
  })

  it("never lets a draft be cached", async () => {
    draft.isEnabled = true
    load.loadInteractiveSearchIndex.mockResolvedValue(index)
    const res = await getSearch(request, args({ slug: "courts" }))
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("GET /interactives/[slug]/regions/[regionId]", () => {
  const asset = { viewBox: null, paths: [], payload: null }

  it("404s an unknown slug without composing anything", async () => {
    load.queryInteractiveBySlug.mockResolvedValue(null)
    await expectNotFound(await getRegion(request, args({ slug: "nope", regionId: "ca8" })))
    expect(load.loadInteractiveRegion).not.toHaveBeenCalled()
  })

  it("404s a region that is not drillable or has no snapshot", async () => {
    load.loadInteractiveRegion.mockResolvedValue(null)
    await expectNotFound(await getRegion(request, args({ slug: "courts", regionId: "zz" })))
  })

  it("serves the region's records with a public cache lifetime", async () => {
    load.loadInteractiveRegion.mockResolvedValue(asset)
    const res = await getRegion(request, args({ slug: "courts", regionId: "ca8" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(PUBLIC)
    await expect(res.json()).resolves.toEqual(asset)
    expect(load.loadInteractiveRegion).toHaveBeenCalledWith(interactive, "ca8")
  })

  it("never lets a draft be cached", async () => {
    draft.isEnabled = true
    load.loadInteractiveRegion.mockResolvedValue(asset)
    const res = await getRegion(request, args({ slug: "courts", regionId: "ca8" }))
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("GET /interactives/[slug]/regions/[regionId]/geometry/[hash]", () => {
  const shapes = { viewBox: [0, 0, 1, 1], paths: [] }
  const params = { slug: "courts", regionId: "ca8", hash: "abc123" }

  it("404s an unknown slug", async () => {
    load.queryInteractiveBySlug.mockResolvedValue(null)
    await expectNotFound(await getGeometry(request, args(params)))
    expect(load.loadInteractiveGeometryHash).not.toHaveBeenCalled()
  })

  it("404s a hash the current geometry does not have, rather than serving it immutable", async () => {
    load.loadInteractiveGeometryHash.mockResolvedValue("def456")
    await expectNotFound(await getGeometry(request, args(params)))
    expect(load.loadInteractiveGeometry).not.toHaveBeenCalled()
  })

  it("404s a region with no geometry entry at all", async () => {
    load.loadInteractiveGeometryHash.mockResolvedValue(null)
    await expectNotFound(await getGeometry(request, args(params)))
  })

  it("serves a matching hash with a year-long immutable lifetime", async () => {
    load.loadInteractiveGeometryHash.mockResolvedValue("abc123")
    load.loadInteractiveGeometry.mockResolvedValue(shapes)
    const res = await getGeometry(request, args(params))
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")
    await expect(res.json()).resolves.toEqual(shapes)
    expect(load.loadInteractiveGeometry).toHaveBeenCalledWith(interactive, "ca8")
  })

  it("404s when the hash matches but there are no shapes to serve", async () => {
    load.loadInteractiveGeometryHash.mockResolvedValue("abc123")
    load.loadInteractiveGeometry.mockResolvedValue(null)
    await expectNotFound(await getGeometry(request, args(params)))
  })
})
