import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { courtTrackerFeed } from "@/interactives/federal-courts/feed"
import {
  DEFAULT_JUDGE,
  miniCourtTracker,
} from "@/interactives/federal-courts/__tests__/miniUpstream"
import type * as filesModule from "@/integrations/files"
import { localFileSource } from "@/integrations/files"

import { CIRCUITS, keepRecords, run } from "../../scripts/snapshot-federal-courts"

// A checkout on disk is only a place to read files from; the mini tracker stands in for it,
// so these tests run the real adapter and validator without a court-tracker clone.
vi.mock("@/integrations/files", async (importOriginal) => ({
  ...(await importOriginal<typeof filesModule>()),
  localFileSource: vi.fn(),
}))

const svg = (id: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path id="${id}" d="M0 0 L10 0 L10 10 Z"/></svg>`

let work: string
let profile: string

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), "snapshot-courts-"))
  profile = path.join(work, "profile")
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => {
  rmSync(work, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(path.join(profile, rel), "utf8")) as unknown

describe("snapshot-federal-courts", () => {
  it("prints its usage and exits 2 for anything that isn't a command", async () => {
    await expect(run(["nonsense"], {}, profile)).resolves.toBe(2)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("usage:"))
  })

  describe("geometry", () => {
    it("writes the national map, every circuit and the seat-block anchors", async () => {
      const source = path.join(work, "court-tracker")
      mkdirSync(path.join(source, "assets", "geo", "circuits"), { recursive: true })
      mkdirSync(path.join(source, "data"))
      writeFileSync(path.join(source, "assets", "geo", "national.svg"), svg("ca1"))
      for (const id of CIRCUITS)
        writeFileSync(path.join(source, "assets", "geo", "circuits", `${id}.svg`), svg(id))
      writeFileSync(
        path.join(source, "data", "seat_blocks.json"),
        JSON.stringify({
          scotus: { anchor: [5, 6] },
          ca8: { anchor: null },
          cafc: { anchor: [1, 2] },
        }),
      )

      await expect(run(["geometry", "--source", source], {}, profile)).resolves.toBe(0)

      expect(readJson("geometry/national.json")).toMatchObject({
        viewBox: [0, 0, 10, 10],
        paths: [expect.objectContaining({ id: "ca1" })],
      })
      for (const id of CIRCUITS)
        expect(readJson(`geometry/circuits/${id}.json`), id).toMatchObject({
          paths: [expect.objectContaining({ id })],
        })
      // A block upstream has not placed is left out, not written as null; the rest are sorted.
      expect(readFileSync(path.join(profile, "geometry", "anchors.json"), "utf8")).toBe(
        '{"cafc":[1,2],"scotus":[5,6]}',
      )
    })
  })

  describe("quantize", () => {
    const write = (rel: string, value: unknown): void => {
      mkdirSync(path.dirname(path.join(profile, rel)), { recursive: true })
      writeFileSync(path.join(profile, rel), JSON.stringify(value))
    }
    const geo = (viewBox: number[], paths: object[]) => ({ viewBox, flipY: true, paths })
    const shape = (id: string, d: string, parentId: string | null = null) => ({
      id,
      d,
      layer: null,
      parentId,
      inset: false,
      label: null,
    })

    beforeEach(() => {
      // National: 4M units across → step 100. The First Circuit's own map: 400k → step 10.
      write(
        "geometry/national.json",
        geo([0, 0, 4_000_000, 2_000_000], [shape("ca1", "M0 0 L1000000 500000")]),
      )
      for (const id of CIRCUITS)
        write(`geometry/circuits/${id}.json`, geo([0, 0, 10, 10], [shape(id, "M0 0 L10 10")]))
      write(
        "geometry/circuits/ca1.json",
        geo(
          [0, 0, 400_000, 400_000],
          [shape("ca1", "M0 0 L400000 400000"), shape("mad", "M12345 6789 L400000 400000", "ca1")],
        ),
      )
      write("geometry/anchors.json", {
        ca1: [1_000_000, 500_000],
        mad: [12345, 6789],
        scotus: [2_000_000, -25_000],
      })
      write("geometry/offsets.json", {
        overview: { akd: [100_000, -100_000] },
        ca1: { prd: [-1474, -122326] },
      })
      write("fixtures/data.json", {
        regions: [
          { id: "ca1", facts: { anchor: "1000000,500000" } },
          { id: "mad", parentId: "ca1", facts: { anchor: "12345,6789" } },
        ],
        records: [],
      })
    })

    it("re-grids every map and rescales what is measured in each map's units with it", async () => {
      await expect(run(["quantize"], {}, profile)).resolves.toBe(0)
      expect(readJson("geometry/national.json")).toMatchObject({
        viewBox: [0, 0, 40_000, 20_000],
        step: 100,
        paths: [expect.objectContaining({ d: "M0 0L10000 5000" })],
      })
      expect(readJson("geometry/circuits/ca1.json")).toMatchObject({
        step: 10,
        paths: [expect.anything(), expect.objectContaining({ d: "M1235 679L40000 40000" })],
      })
      // A circuit and a court with no shape are drawn on the national map; a district on its circuit's.
      expect(readJson("geometry/anchors.json")).toEqual({
        ca1: [10_000, 5000],
        mad: [1235, 679],
        scotus: [20_000, -250],
      })
      expect(readJson("geometry/offsets.json")).toEqual({
        overview: { akd: [1000, -1000] },
        ca1: { prd: [-147, -12233] },
      })
      expect(readJson("fixtures/data.json")).toMatchObject({
        regions: [{ facts: { anchor: "10000,5000" } }, { facts: { anchor: "1235,679" } }],
      })
    })

    it("changes nothing the second time", async () => {
      await run(["quantize"], {}, profile)
      const files = [
        "geometry/national.json",
        "geometry/circuits/ca1.json",
        "geometry/anchors.json",
        "geometry/offsets.json",
        "fixtures/data.json",
      ]
      const once = files.map(readJson)
      await run(["quantize"], {}, profile)
      expect(files.map(readJson)).toEqual(once)
    })
  })

  describe("data", () => {
    it("refuses to guess where to read from without a checkout or a token", async () => {
      await expect(run(["data"], {}, profile)).resolves.toBe(1)
      expect(console.error).toHaveBeenCalledWith(
        "set COURT_TRACKER_GITHUB_TOKEN or pass --source <checkout>",
      )
    })

    it("runs a checkout through the real adapter and writes the fixture, naming the release", async () => {
      vi.mocked(localFileSource).mockReturnValue(await miniCourtTracker({ version: "v7" }))
      const source = path.join(work, "court-tracker")

      await expect(
        run(["data", "--source", source, "--ref", "data-v7"], {}, profile),
      ).resolves.toBe(0)

      expect(localFileSource).toHaveBeenCalledWith(path.resolve(source))
      const data = readJson("fixtures/data.json") as {
        source: { version: string; ref?: string }
        records: { _region: string }[]
      }
      expect(data.source).toMatchObject({ version: "v7", ref: "data-v7" })
      expect(data.records).toContainEqual(
        expect.objectContaining({ _region: DEFAULT_JUDGE.court_id }),
      )
    })

    it("trims the fixture to the benches it is told to keep, and nothing else", async () => {
      vi.mocked(localFileSource).mockReturnValue(await miniCourtTracker())
      const source = path.join(work, "court-tracker")
      const records = async (keep: string) => {
        await run(["data", "--source", source, "--keep", keep], {}, profile)
        return readJson("fixtures/data.json") as { records: unknown[]; regions: unknown[] }
      }
      // The mini tracker's one judge sits on a district court in the Eighth Circuit.
      expect((await records("ca8")).records).toHaveLength(1)
      const trimmed = await records("ca1,scotus")
      expect(trimmed.records).toHaveLength(0)
      // Every region stays: the map's seat counts are facts on the regions, not records.
      expect(trimmed.regions.length).toBeGreaterThan(100)
    })

    it("records the directory as the ref when a checkout's release isn't named", async () => {
      vi.mocked(localFileSource).mockReturnValue(await miniCourtTracker())
      const source = path.join(work, "court-tracker")
      await expect(run(["data", "--source", source], {}, profile)).resolves.toBe(0)
      expect(readJson("fixtures/data.json")).toMatchObject({
        source: { ref: `dir:${path.resolve(source)}` },
      })
    })

    it("reads GitHub's newest release with the token, and records the tag it resolved", async () => {
      const files = await miniCourtTracker()
      const readFiles = courtTrackerFeed.fetch.bind(courtTrackerFeed)
      // What GitHub would have served, as the adapter reports it: the sources, and the tag
      // `release` resolved to.
      const fetch = vi.spyOn(courtTrackerFeed, "fetch").mockImplementation(async () => ({
        ...(await readFiles({ ref: "unused", files })),
        ref: "data-vabc",
      }))

      await expect(run(["data"], { COURT_TRACKER_GITHUB_TOKEN: "t0ken" }, profile)).resolves.toBe(0)

      expect(fetch).toHaveBeenCalledWith({ ref: "release", token: "t0ken" })
      expect(readJson("fixtures/data.json")).toMatchObject({ source: { ref: "data-vabc" } })
    })

    it("writes nothing and exits 1 when the feed fails validation", async () => {
      // A judge on a court the geometry has never heard of: the referential check's job.
      vi.mocked(localFileSource).mockReturnValue(
        await miniCourtTracker({
          judges: [{ ...DEFAULT_JUDGE, court_id: "atlantis" }],
          extraCourts: [
            {
              court_id: "atlantis",
              court_name: "Court of Atlantis",
              short_name: "ATL",
              court_level: "district",
              parent_id: "ca8",
              tenure_type: "life_tenured",
              authorized_judgeships: 1,
              has_geography: true,
              is_inset: false,
              geometry_key: "atlantis",
            },
          ],
        }),
      )
      await expect(run(["data", "--source", path.join(work, "ct")], {}, profile)).resolves.toBe(1)
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("feed is invalid"))
      expect(() => readJson("fixtures/data.json")).toThrow()
    })
  })
})

describe("keepRecords", () => {
  const data = {
    regions: [
      { id: "ca1" },
      { id: "mad", parentId: "ca1" },
      { id: "ca8" },
      { id: "moed", parentId: "ca8" },
      { id: "cafc" },
      { id: "cit", parentId: "cafc" },
    ],
    records: [
      { _region: "mad", _id: "district" },
      { _region: "ca1", _id: "circuit" },
      { _region: "moed", _id: "elsewhere" },
      { _region: "ca8", _id: "justice", _role: "associate" },
      { _region: "cit", _id: "specialist" },
      { _region: "gone", _id: "unknown-region" },
    ],
  } as unknown as Parameters<typeof keepRecords>[0]

  it("keeps whole subtrees of the named regions, and every circuit justice", () => {
    const ids = (keep: string[]) => keepRecords(data, keep).records.map((r) => r._id)
    expect(ids(["ca1"])).toEqual(["district", "circuit", "justice"])
    expect(ids(["cafc"])).toEqual(["justice", "specialist"])
    // A record on a region the data does not declare is its own top level.
    expect(ids(["gone"])).toEqual(["justice", "unknown-region"])
    expect(keepRecords(data, ["ca1"]).regions).toBe(data.regions)
  })
})
