import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-email/render", () => ({ render: vi.fn().mockResolvedValue("<html>body</html>") }))
vi.mock("@/utilities/getURL", () => ({ getServerSideURL: () => "https://site.example.com" }))
vi.mock("@/utilities/listmonk", () => ({
  listScheduledCampaigns: vi.fn(),
  createScheduledCampaign: vi.fn().mockResolvedValue(123),
  updateScheduledCampaign: vi.fn().mockResolvedValue(undefined),
}))

import {
  createScheduledCampaign,
  listScheduledCampaigns,
  updateScheduledCampaign,
  type ScheduledCampaignSummary,
} from "@/utilities/listmonk"
import { scheduleVolumeNewsletter } from "../logic"

function makePayload(articles: unknown[]) {
  return {
    findByID: vi.fn().mockResolvedValue({
      id: 5,
      title: "Vol Title",
      volumeNumber: 7,
      slug: "vol-7",
      articles,
    }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as never
}

function article(id: number, title: string, status = "published") {
  return { id, title, slug: `art-${id}`, _status: status }
}

function existing(overrides: Partial<ScheduledCampaignSummary>): ScheduledCampaignSummary {
  return {
    id: 1,
    name: "old name",
    status: "scheduled",
    sendAt: new Date("2026-07-01T11:00:00.000Z"),
    tags: [],
    ...overrides,
  }
}

describe("scheduleVolumeNewsletter", () => {
  const originalBuildEnv = process.env.BUILD_ENV
  beforeEach(() => {
    // Baseline these cases as production so they exercise the bare "newsletter"
    // tag; env-namespacing isolation is covered separately below.
    process.env.BUILD_ENV = "production"
    vi.mocked(listScheduledCampaigns).mockResolvedValue([])
  })
  afterEach(() => {
    if (originalBuildEnv === undefined) delete process.env.BUILD_ENV
    else process.env.BUILD_ENV = originalBuildEnv
    vi.clearAllMocks()
  })

  it("creates a campaign for every published article when none exist", async () => {
    const result = await scheduleVolumeNewsletter(
      makePayload([article(1, "One"), article(2, "Two"), article(3, "Three")]),
      5,
    )
    expect(result).toEqual({ created: 3, updated: 0 })
    expect(createScheduledCampaign).toHaveBeenCalledTimes(3)
    expect(updateScheduledCampaign).not.toHaveBeenCalled()
  })

  it("skips draft articles", async () => {
    const result = await scheduleVolumeNewsletter(
      makePayload([article(1, "One"), article(2, "Draft", "draft")]),
      5,
    )
    expect(result).toEqual({ created: 1, updated: 0 })
  })

  it("updates an already-scheduled article's content in place, keeping its send_at and tags", async () => {
    vi.mocked(listScheduledCampaigns).mockResolvedValue([
      existing({
        id: 42,
        status: "scheduled",
        sendAt: new Date("2026-07-02T11:00:00.000Z"),
        // Includes an extra tag an admin added in Listmonk.
        tags: ["newsletter", "vol-7", "art-2", "manual-pin"],
      }),
    ])

    const result = await scheduleVolumeNewsletter(
      makePayload([article(1, "One"), article(2, "Two"), article(3, "Three")]),
      5,
    )

    expect(result).toEqual({ created: 2, updated: 1 })
    expect(updateScheduledCampaign).toHaveBeenCalledTimes(1)
    expect(updateScheduledCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 42,
        subject: "Two",
        sendAt: "2026-07-02T11:00:00.000Z",
        // Fetched tags are copied back verbatim, preserving the admin tag.
        tags: ["newsletter", "vol-7", "art-2", "manual-pin"],
      }),
    )
    // Only the two new articles are created.
    expect(createScheduledCampaign).toHaveBeenCalledTimes(2)
  })

  it("leaves a campaign that has already started sending untouched", async () => {
    vi.mocked(listScheduledCampaigns).mockResolvedValue([
      existing({ id: 42, status: "running", tags: ["newsletter", "vol-7", "art-1"] }),
    ])

    const result = await scheduleVolumeNewsletter(makePayload([article(1, "One")]), 5)

    expect(result).toEqual({ created: 0, updated: 0 })
    expect(updateScheduledCampaign).not.toHaveBeenCalled()
    expect(createScheduledCampaign).not.toHaveBeenCalled()
  })

  it("ignores existing campaigns tagged for a different volume", async () => {
    vi.mocked(listScheduledCampaigns).mockResolvedValue([
      existing({ id: 99, status: "scheduled", tags: ["newsletter", "vol-3", "art-1"] }),
    ])

    const result = await scheduleVolumeNewsletter(makePayload([article(1, "One")]), 5)

    expect(result).toEqual({ created: 1, updated: 0 })
    expect(updateScheduledCampaign).not.toHaveBeenCalled()
  })

  it("namespaces tags and names by BUILD_ENV, ignoring another environment's campaigns", async () => {
    process.env.BUILD_ENV = "staging"
    // A production campaign (bare "newsletter" tag) for the same article must not
    // be matched — staging looks for "newsletter-staging".
    vi.mocked(listScheduledCampaigns).mockResolvedValue([
      existing({ id: 42, status: "scheduled", tags: ["newsletter", "vol-7", "art-1"] }),
    ])

    const result = await scheduleVolumeNewsletter(makePayload([article(1, "One")]), 5)

    expect(result).toEqual({ created: 1, updated: 0 })
    expect(updateScheduledCampaign).not.toHaveBeenCalled()
    const input = vi.mocked(createScheduledCampaign).mock.calls[0]![0]
    expect(input.tags).toEqual(["newsletter-staging", "vol-7", "art-1"])
    expect(input.name).toBe("[staging] Volume 7 · Day 1 of 1 · One")
  })
})
