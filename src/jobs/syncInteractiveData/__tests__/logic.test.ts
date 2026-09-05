import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Payload } from "payload"

import {
  DEFAULT_JUDGE,
  miniCourtTracker,
} from "@/interactives/federal-courts/__tests__/miniUpstream"
import type { Judge } from "@/interactives/federal-courts/upstream"
import type { Interactive, InteractiveSnapshot } from "@/payload-types"

import { describeData, syncInteractive } from "../logic"

const silentLog = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const upstream = (version = "v1", judge: Partial<Judge> = {}) =>
  miniCourtTracker({ version, judges: [{ ...DEFAULT_JUDGE, ...judge }] })

/** A file source with some paths replaced. */
function memoryFiles(
  base: {
    read(path: string): Promise<string>
    readJson<T>(path: string): Promise<T>
    describe(): string
  },
  overrides: Record<string, unknown>,
) {
  return {
    describe: () => "memory",
    read: (path: string) =>
      path in overrides ? Promise.resolve(JSON.stringify(overrides[path])) : base.read(path),
    readJson: <T>(path: string): Promise<T> =>
      path in overrides ? Promise.resolve(overrides[path] as T) : base.readJson<T>(path),
  }
}

function interactive(over: Partial<Interactive> = {}): Interactive {
  return {
    id: 7,
    title: "Federal Courts",
    slug: "federal-courts",
    profile: "federal-courts",
    feed: { enabled: true, ref: "main", autoPublish: false },
    updatedAt: "",
    createdAt: "",
    ...over,
  } as Interactive
}

/** A Payload stub that remembers the one snapshot document and what was written to it. */
function stubPayload(existing: Partial<InteractiveSnapshot> | null) {
  const writes: { op: "create" | "update"; args: Record<string, unknown> }[] = []
  const payload = {
    find: vi.fn(async () => ({ docs: existing ? [{ id: 42, ...existing }] : [] })),
    create: vi.fn(async (args: Record<string, unknown>) => {
      writes.push({ op: "create", args })
      return { id: 43 }
    }),
    update: vi.fn(async (args: Record<string, unknown>) => {
      writes.push({ op: "update", args })
      return { id: 42 }
    }),
  }
  return { payload: payload as unknown as Payload, writes }
}

beforeEach(() => {
  vi.stubEnv("COURT_TRACKER_GITHUB_TOKEN", "")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("syncInteractive", () => {
  it("creates a draft snapshot on the first run", async () => {
    const { payload, writes } = stubPayload(null)
    const outcome = await syncInteractive(payload, interactive(), {
      log: silentLog,
      files: await upstream("v1"),
    })
    expect(outcome).toEqual({
      outcome: "synced",
      status: "draft",
      sourceVersion: "v1",
      contentHash: expect.stringMatching(/^[0-9a-f]{16}$/),
    })
    expect(writes).toHaveLength(1)
    const { op, args } = writes[0]!
    expect(op).toBe("create")
    expect(args).toMatchObject({
      collection: "interactive-snapshots",
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    const data = args.data as Record<string, unknown>
    expect(data).toMatchObject({
      interactive: 7,
      _status: "draft",
      sourceVersion: "v1",
      sourceRef: "main",
      generatedAt: "2026-09-05T11:10:40Z",
      summary: "110 regions · 1 records",
      label: "Federal Courts — 2026-09-05 (v1)",
    })
    expect((data.data as { regions: unknown[] }).regions).toHaveLength(110)
  })

  it("publishes directly when the interactive auto-publishes", async () => {
    const { payload, writes } = stubPayload(null)
    const outcome = await syncInteractive(
      payload,
      interactive({ feed: { enabled: true, ref: "v2026.09", autoPublish: true } }),
      { log: silentLog, files: await upstream() },
    )
    expect(outcome).toMatchObject({ outcome: "synced", status: "published" })
    expect(writes[0]!.args).toMatchObject({ draft: false })
    const data = writes[0]!.args.data as Record<string, unknown>
    expect(data._status).toBe("published")
    expect(data.sourceRef).toBe("v2026.09")
  })

  it("does not read upstream when its version stamp has not moved", async () => {
    const files = await upstream("v1")
    const read = vi.spyOn(files, "readJson")
    const { payload, writes } = stubPayload({
      sourceVersion: "v1",
      contentHash: "x",
      _status: "published",
    })
    const outcome = await syncInteractive(payload, interactive(), { log: silentLog, files })
    expect(outcome).toEqual({ outcome: "unchanged", reason: "source-version" })
    expect(read).toHaveBeenCalledTimes(1) // the manifest only
    expect(writes).toHaveLength(0)
  })

  it("stamps the existing version, without a new one, when upstream rebuilt identical content", async () => {
    // Establish the content hash of this upstream by syncing once.
    const first = stubPayload(null)
    const synced = await syncInteractive(first.payload, interactive(), {
      log: silentLog,
      files: await upstream("v1"),
    })
    const hash = synced.outcome === "synced" ? synced.contentHash : ""

    const { payload, writes } = stubPayload({
      sourceVersion: "v1",
      contentHash: hash,
      _status: "published",
    })
    const outcome = await syncInteractive(payload, interactive(), {
      log: silentLog,
      files: await upstream("v2"),
      now: () => new Date("2026-09-06T00:00:00Z"),
    })
    expect(outcome).toEqual({ outcome: "unchanged", reason: "content" })
    expect(writes).toEqual([
      {
        op: "update",
        args: expect.objectContaining({
          id: 42,
          draft: false, // the live version stays published
          data: { sourceVersion: "v2", sourceRef: "main", syncedAt: "2026-09-06T00:00:00.000Z" },
        }),
      },
    ])
  })

  it("writes a new draft version when the content changed", async () => {
    const { payload, writes } = stubPayload({
      sourceVersion: "v1",
      contentHash: "old",
      _status: "published",
    })
    const outcome = await syncInteractive(payload, interactive(), {
      log: silentLog,
      files: await upstream("v2", { status: "senior", senior_date: "2026-01-01" }),
    })
    expect(outcome).toMatchObject({ outcome: "synced", status: "draft", sourceVersion: "v2" })
    expect(writes[0]).toMatchObject({ op: "update", args: { id: 42, draft: true } })
  })

  it("re-reads on force even when the version stamp matches", async () => {
    const { payload, writes } = stubPayload({
      sourceVersion: "v1",
      contentHash: "old",
      _status: "draft",
    })
    const outcome = await syncInteractive(payload, interactive(), {
      log: silentLog,
      files: await upstream("v1"),
      force: true,
    })
    expect(outcome).toMatchObject({ outcome: "synced" })
    expect(writes).toHaveLength(1)
  })

  it("throws, without writing, when the adapter cannot reshape upstream (the job counts it as failed)", async () => {
    const { payload, writes } = stubPayload({
      sourceVersion: "v1",
      contentHash: "old",
      _status: "published",
    })
    // A judge on a court that courts.json no longer lists: the adapter refuses rather than
    // guessing, the exception reaches the job handler, and nothing is written.
    await expect(
      syncInteractive(payload, interactive(), {
        log: silentLog,
        files: await upstream("v2", { court_id: "moed-renamed" }),
      }),
    ).rejects.toThrow('judge Jane Q. Judge sits on unknown court "moed-renamed"')
    expect(writes).toHaveLength(0)
  })

  it("keeps the last good snapshot when upstream renames a region the geometry draws", async () => {
    const { payload, writes } = stubPayload({
      sourceVersion: "v1",
      contentHash: "old",
      _status: "published",
    })
    // Upstream now calls E.D. Missouri "moe": a declaration with no shape beside a shape
    // with no declaration. Validation fails, the job logs it, nothing is written.
    const files = await miniCourtTracker({
      version: "v2",
      judges: [{ ...DEFAULT_JUDGE, court_id: "moe" }],
      extraCourts: [
        {
          court_id: "moe",
          court_name: "E.D. Mo. (renamed)",
          short_name: "E.D. Mo.",
          court_level: "district",
          parent_id: "ca8",
          tenure_type: "life_tenured",
          authorized_judgeships: 7,
          has_geography: true,
          is_inset: false,
          geometry_key: "moe",
        },
      ],
    })
    const courts = await files.readJson<{ court_id: string }[]>("data/courts.json")
    const renamed = memoryFiles(files, {
      "data/courts.json": courts.filter((c) => c.court_id !== "moed"),
    })
    const outcome = await syncInteractive(payload, interactive(), {
      log: silentLog,
      files: renamed,
    })
    expect(outcome).toEqual({
      outcome: "failed",
      errors: [
        'region "moe" has no geometry but its parent "ca8" is drawn — was a region renamed upstream?',
        'geometry draws "moed" but the feed declares no such region',
      ],
    })
    expect(writes).toHaveLength(0)
    expect(silentLog.error).toHaveBeenCalledWith(
      expect.stringContaining("keeping the last good snapshot"),
    )
  })

  it("skips a disabled feed, an unknown profile, and a private upstream without a token", async () => {
    const { payload, writes } = stubPayload(null)
    await expect(
      syncInteractive(payload, interactive({ feed: { enabled: false, ref: "main" } }), {
        log: silentLog,
        files: await upstream(),
      }),
    ).resolves.toEqual({ outcome: "skipped", reason: "feed disabled" })
    await expect(
      syncInteractive(payload, interactive({ profile: "nope" as Interactive["profile"] }), {
        log: silentLog,
        files: await upstream(),
      }),
    ).resolves.toEqual({ outcome: "skipped", reason: 'unknown profile "nope"' })
    await expect(syncInteractive(payload, interactive(), { log: silentLog })).resolves.toEqual({
      outcome: "skipped",
      reason: "COURT_TRACKER_GITHUB_TOKEN not set",
    })
    expect(writes).toHaveLength(0)
  })
})

describe("describeData", () => {
  it("counts regions, records and names the datasets", () => {
    expect(
      describeData({
        schema: "pragmatic-papers/drilldown-data@1",
        generatedAt: "",
        source: { name: "x", version: "1" },
        regions: new Array(1503).fill({ id: "x" }),
        records: [],
        datasets: { a: [], b: {} },
      }),
    ).toBe("1,503 regions · 0 records · datasets: a, b")
  })
})
