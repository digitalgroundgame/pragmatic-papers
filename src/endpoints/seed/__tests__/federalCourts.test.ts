// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import fixture from "@/interactives/federal-courts/fixtures/data.json"
import type * as integrations from "@/integrations"

const { status, fetchFeed, adapt } = vi.hoisted(() => ({
  status: { configured: false },
  fetchFeed: vi.fn(),
  adapt: vi.fn(),
}))

// The connection and the feed are the outside world; validation, geometry and the snapshot
// fields are the real ones, so a fixture or a release that would not render fails here too.
vi.mock("@/integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof integrations>()),
  integrationStatus: () => ({
    ...status,
    missing: status.configured ? [] : ["COURT_TRACKER_GITHUB_TOKEN"],
  }),
}))
vi.mock("@/interactives/federal-courts/feed", () => ({
  courtTrackerFeed: { fetch: fetchFeed, adapt },
}))

import { createFederalCourtsInteractive } from "../features/interactives"

const create = vi.fn()
const logger = { info: vi.fn(), warn: vi.fn() }
const payload = { create, logger } as unknown as Parameters<
  typeof createFederalCourtsInteractive
>[0]

/** The snapshot the seed wrote, as the sync would have written it. */
const snapshot = () =>
  create.mock.calls.find(([args]) => args.collection === "interactive-snapshots")?.[0].data as {
    sourceRef: string
    data: { records: unknown[] }
    _status: string
  }

const release = {
  ...fixture,
  source: { ...fixture.source, ref: "data-vlive" },
  records: fixture.records.slice(0, 3),
}

beforeEach(() => {
  vi.clearAllMocks()
  status.configured = false
  create.mockImplementation(async ({ collection }: { collection: string }) =>
    collection === "interactives" ? { id: 7, title: "Federal Court Appointment Tracker" } : {},
  )
  fetchFeed.mockResolvedValue({ version: "vlive", ref: "data-vlive" })
  adapt.mockReturnValue(release)
})

describe("createFederalCourtsInteractive", () => {
  it("publishes a snapshot of the trimmed fixture by default, never touching upstream", async () => {
    status.configured = true
    await expect(createFederalCourtsInteractive(payload)).resolves.toBe(7)
    expect(fetchFeed).not.toHaveBeenCalled()
    expect(snapshot()).toMatchObject({ _status: "published", sourceRef: fixture.source.ref })
    expect(snapshot().data.records).toHaveLength(fixture.records.length)
  })

  it("reads upstream's newest release when asked to and a token is set", async () => {
    status.configured = true
    await createFederalCourtsInteractive(payload, undefined, undefined, { live: true })
    expect(fetchFeed).toHaveBeenCalledWith({ ref: "release" })
    expect(adapt).toHaveBeenCalledWith(expect.anything(), { ref: "data-vlive" })
    expect(snapshot()).toMatchObject({ sourceRef: "data-vlive" })
    expect(snapshot().data.records).toHaveLength(3)
  })

  it("says why and uses the fixture when there is no token", async () => {
    await createFederalCourtsInteractive(payload, undefined, undefined, { live: true })
    expect(fetchFeed).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("COURT_TRACKER_GITHUB_TOKEN"))
    expect(snapshot().data.records).toHaveLength(fixture.records.length)
  })

  it("falls back to the fixture when upstream cannot be read", async () => {
    status.configured = true
    fetchFeed.mockRejectedValue(new Error("HTTP 401"))
    await createFederalCourtsInteractive(payload, undefined, undefined, { live: true })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 401"))
    expect(snapshot().data.records).toHaveLength(fixture.records.length)
  })

  it("falls back to the fixture when the release fails validation", async () => {
    status.configured = true
    adapt.mockReturnValue({ ...release, records: [{ _region: "atlantis" }] })
    await createFederalCourtsInteractive(payload, undefined, undefined, { live: true })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("is invalid"))
    expect(snapshot()).toMatchObject({ sourceRef: fixture.source.ref })
  })
})
