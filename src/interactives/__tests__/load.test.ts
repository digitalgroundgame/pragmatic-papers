// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Interactive } from "@/payload-types"

import { composeChildData, composeChildGeometry } from "../compose"
import { geometryHash, profileFingerprint } from "../hash"
import { composeSearchIndex } from "../search"
import {
  DRILLDOWN_DATA_SCHEMA,
  type DrilldownData,
  type DrilldownGeometry,
  type DrilldownPresentation,
  type InteractiveProfile,
} from "../types"

const { find, draft, unstableCache } = vi.hoisted(() => ({
  find: vi.fn(),
  draft: { isEnabled: false },
  // `unstable_cache` needs a Next.js request scope to cache anything; only its key and
  // options matter here, so it hands the composer straight back.
  unstableCache: vi.fn(
    (
      fn: () => Promise<unknown>,
      _keyParts?: string[],
      _options?: { tags?: string[]; revalidate?: number },
    ) => fn,
  ),
}))

vi.mock("next/headers", () => ({ draftMode: async () => draft }))
vi.mock("next/cache", () => ({
  unstable_cache: (...args: Parameters<typeof unstableCache>) => unstableCache(...args),
}))
vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => ({ find }) }))

const path = (id: string, parentId: string | null) => ({
  id,
  d: `M${id}`,
  layer: parentId ? "district" : "circuit",
  parentId,
  inset: false,
  label: null,
})

const geometry: DrilldownGeometry = {
  overview: {
    viewBox: [0, 0, 100, 100],
    flipY: true,
    paths: [path("ca8", null), path("cafc", null)],
  },
  children: {
    ca8: { viewBox: [0, 0, 50, 50], flipY: false, paths: [path("moed", "ca8")] },
    cafc: null,
  },
}

const presentation: DrilldownPresentation = {
  display: {
    title: "full_name",
    category: { field: "party", values: [] },
    details: [{ field: "full_name" }],
  },
}

const data: DrilldownData = {
  schema: DRILLDOWN_DATA_SCHEMA,
  generatedAt: "2026-09-05T00:00:00Z",
  source: { name: "court-tracker", version: "abc123" },
  regions: [{ id: "ca8" }, { id: "moed", parentId: "ca8" }],
  records: [
    { _region: "moed", _id: "m1", full_name: "Judge Moed" },
    { _region: "scotus", _id: "s1", full_name: "Justice One" },
  ],
}

const summaryCompose = vi.fn(() => ({ judges: 2 }))
const loadGeometry = vi.fn(async () => geometry)

const profile = {
  id: "test",
  label: "Test",
  presentation,
  loadGeometry,
  metaLine: () => "2 judges",
  summary: { compose: summaryCompose, render: () => null },
} as unknown as InteractiveProfile

const bareProfile = {
  id: "bare",
  label: "Bare",
  presentation,
  loadGeometry: async () => geometry,
} as unknown as InteractiveProfile

vi.mock("../profiles", () => ({
  getProfile: (id: string) => ({ test: profile, bare: bareProfile })[id] ?? null,
}))

const {
  loadInteractiveGeometry,
  loadInteractiveGeometryHash,
  loadInteractiveOverview,
  loadInteractiveRegion,
  loadInteractiveSearchIndex,
  queryInteractiveBySlug,
} = await import("../load")

// Profile ids are a closed union in the generated types; these name the mocked registry's.
const withProfile = (id: number, slug: string, profileId: string) =>
  ({ id, slug, profile: profileId }) as unknown as Interactive
const interactive = withProfile(5, "courts", "test")
const bare = withProfile(5, "courts", "bare")
const orphan = withProfile(6, "orphan", "retired")

/** Answers the snapshot query with `snapshotData`, or with no snapshot at all. */
function serveSnapshot(snapshotData?: unknown): void {
  find.mockImplementation(async ({ collection }: { collection: string }) => ({
    docs:
      collection === "interactive-snapshots" && snapshotData !== undefined
        ? [{ data: snapshotData }]
        : [],
  }))
}

const fingerprint = profileFingerprint(presentation, geometry)
const cacheOptions = { tags: ["interactive:5"], revalidate: 3600 }

beforeEach(() => {
  draft.isEnabled = false
  find.mockReset()
  unstableCache.mockClear()
  summaryCompose.mockClear()
  loadGeometry.mockClear()
  serveSnapshot(data)
})

describe("queryInteractiveBySlug", () => {
  it("reads the published version under the reader's access outside draft mode", async () => {
    find.mockResolvedValue({ docs: [interactive] })
    await expect(queryInteractiveBySlug("courts")).resolves.toBe(interactive)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "interactives",
        draft: false,
        overrideAccess: false,
        where: { slug: { equals: "courts" } },
      }),
    )
  })

  it("reads the newest draft, past access control, in draft mode", async () => {
    draft.isEnabled = true
    find.mockResolvedValue({ docs: [interactive] })
    await queryInteractiveBySlug("draft-courts")
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true, overrideAccess: true }),
    )
  })

  it("returns null for a slug nothing has", async () => {
    find.mockResolvedValue({ docs: [] })
    await expect(queryInteractiveBySlug("missing")).resolves.toBeNull()
  })
})

describe("loadInteractiveOverview", () => {
  it("returns null for a profile the site no longer has, without reading anything", async () => {
    await expect(loadInteractiveOverview(orphan)).resolves.toBeNull()
    expect(find).not.toHaveBeenCalled()
  })

  it("returns null when there is no snapshot, or one written to another schema", async () => {
    serveSnapshot()
    await expect(loadInteractiveOverview(interactive)).resolves.toBeNull()
    serveSnapshot({ ...data, schema: "someone-else/data@1" })
    await expect(loadInteractiveOverview(interactive)).resolves.toBeNull()
  })

  it("points each region at a records URL and a geometry URL named by its own hash", async () => {
    const result = await loadInteractiveOverview(interactive)
    expect(result?.childAssets).toEqual([
      {
        regionId: "ca8",
        url: "/interactives/courts/regions/ca8",
        geometryUrl: `/interactives/courts/regions/ca8/geometry/${geometryHash(geometry.children.ca8 ?? null)}`,
      },
      {
        regionId: "cafc",
        url: "/interactives/courts/regions/cafc",
        geometryUrl: "/interactives/courts/regions/cafc/geometry/none",
      },
    ])
    expect(result?.searchUrl).toBe("/interactives/courts/search")
  })

  it("carries the profile's summary and meta line and the feed's provenance", async () => {
    const result = await loadInteractiveOverview(interactive)
    expect(summaryCompose).toHaveBeenCalledWith({ presentation, data })
    expect(result).toMatchObject({
      summary: { judges: 2 },
      metaLine: "2 judges",
      generatedAt: data.generatedAt,
      source: data.source,
      problems: [],
    })
  })

  it("leaves summary and meta line null for a profile that declares neither", async () => {
    const result = await loadInteractiveOverview(bare)
    expect(result).toMatchObject({ summary: null, metaLine: null })
  })

  it("caches under the profile's fingerprint, tagged so the sync can drop it", async () => {
    await loadInteractiveOverview(interactive)
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["interactive-overview", "5", "courts", fingerprint],
      cacheOptions,
    )
  })

  it("skips the cache and reads the draft snapshot in draft mode", async () => {
    draft.isEnabled = true
    await expect(loadInteractiveOverview(interactive)).resolves.not.toBeNull()
    expect(unstableCache).not.toHaveBeenCalled()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "interactive-snapshots",
        draft: true,
        overrideAccess: true,
      }),
    )
  })

  it("still renders, but reports it, when the overview geometry has no viewBox", async () => {
    draft.isEnabled = true
    loadGeometry.mockResolvedValueOnce({
      ...geometry,
      overview: { ...geometry.overview, viewBox: null },
    })
    const result = await loadInteractiveOverview(interactive)
    expect(result?.problems).toEqual(["overview geometry has no usable viewBox"])
  })
})

describe("loadInteractiveRegion", () => {
  it("returns null for an unknown profile or a missing snapshot", async () => {
    await expect(loadInteractiveRegion(orphan, "ca8")).resolves.toBeNull()
    serveSnapshot()
    await expect(loadInteractiveRegion(interactive, "ca8")).resolves.toBeNull()
  })

  it("composes the region's records, cached per region under the fingerprint", async () => {
    await expect(loadInteractiveRegion(interactive, "ca8")).resolves.toEqual(
      composeChildData({ presentation, geometry, data }, "ca8"),
    )
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["interactive-region", "5", "ca8", fingerprint],
      cacheOptions,
    )
  })

  it("skips the cache in draft mode", async () => {
    draft.isEnabled = true
    await expect(loadInteractiveRegion(interactive, "ca8")).resolves.not.toBeNull()
    expect(unstableCache).not.toHaveBeenCalled()
  })
})

describe("loadInteractiveGeometry", () => {
  it("serves one region's shapes straight from the profile, with no snapshot read", async () => {
    await expect(loadInteractiveGeometry(interactive, "ca8")).resolves.toEqual(
      composeChildGeometry(geometry, "ca8"),
    )
    expect(find).not.toHaveBeenCalled()
  })

  it("returns null for an unknown profile", async () => {
    await expect(loadInteractiveGeometry(orphan, "ca8")).resolves.toBeNull()
  })
})

describe("loadInteractiveGeometryHash", () => {
  it("names a region's geometry the way the overview's URLs do", async () => {
    await expect(loadInteractiveGeometryHash(interactive, "ca8")).resolves.toBe(
      geometryHash(geometry.children.ca8 ?? null),
    )
    await expect(loadInteractiveGeometryHash(interactive, "cafc")).resolves.toBe("none")
  })

  it("returns null for a region with no entry, including inherited object keys", async () => {
    await expect(loadInteractiveGeometryHash(interactive, "nowhere")).resolves.toBeNull()
    await expect(loadInteractiveGeometryHash(interactive, "toString")).resolves.toBeNull()
    await expect(loadInteractiveGeometryHash(orphan, "ca8")).resolves.toBeNull()
  })
})

describe("loadInteractiveSearchIndex", () => {
  it("returns null for an unknown profile or a missing snapshot", async () => {
    await expect(loadInteractiveSearchIndex(orphan)).resolves.toBeNull()
    serveSnapshot()
    await expect(loadInteractiveSearchIndex(interactive)).resolves.toBeNull()
  })

  it("composes the index from the profile and the snapshot, cached under the fingerprint", async () => {
    await expect(loadInteractiveSearchIndex(interactive)).resolves.toEqual(
      composeSearchIndex({ presentation, data }),
    )
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["interactive-search", "5", "courts", fingerprint],
      cacheOptions,
    )
  })

  it("skips the cache in draft mode", async () => {
    draft.isEnabled = true
    await expect(loadInteractiveSearchIndex(interactive)).resolves.not.toBeNull()
    expect(unstableCache).not.toHaveBeenCalled()
  })
})
