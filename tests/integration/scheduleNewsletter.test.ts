import type { Payload } from "payload"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utilities/listmonk", () => ({
  listScheduledCampaigns: vi.fn(),
  createScheduledCampaign: vi.fn(),
  updateScheduledCampaign: vi.fn(),
}))
vi.mock("@react-email/render", () => ({
  render: vi.fn().mockResolvedValue("<html/>"),
}))

import { scheduleVolumeNewsletter } from "@/collections/Volumes/endpoints/scheduleNewsletter/logic"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { ScheduledCampaignSummary } from "@/utilities/listmonk"
import {
  createScheduledCampaign,
  listScheduledCampaigns,
  updateScheduledCampaign,
} from "@/utilities/listmonk"

const MINIMAL_CONTENT = {
  root: {
    type: "root",
    format: "" as "" | "left" | "start" | "center" | "right" | "end" | "justify",
    indent: 0,
    version: 1,
    direction: "ltr" as "ltr" | "rtl" | null,
    children: [
      {
        type: "paragraph",
        format: "",
        indent: 0,
        version: 1,
        direction: "ltr",
        children: [{ text: "Test content.", type: "text", version: 1 }],
      },
    ],
  },
}

let payload: Payload
let volNum = 900 // high number to avoid conflicts with other integration tests
const originalBuildEnv = process.env.BUILD_ENV

beforeAll(async () => {
  // Exercise the production code path so campaigns carry the bare "newsletter"
  // tag asserted below; env-namespacing is unit-tested in logic.test.ts.
  process.env.BUILD_ENV = "production"
  payload = await getPayloadConfig()
})

afterAll(async () => {
  if (originalBuildEnv === undefined) delete process.env.BUILD_ENV
  else process.env.BUILD_ENV = originalBuildEnv
  await payload.db.destroy?.()
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(createScheduledCampaign).mockResolvedValue(1)
  vi.mocked(updateScheduledCampaign).mockResolvedValue(undefined)
})

async function createArticle(slug: string) {
  return payload.create({
    collection: "articles",
    data: { title: slug, _status: "published", slug, content: MINIMAL_CONTENT },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
}

async function createVolume(articleIds: number[]) {
  const num = ++volNum
  return payload.create({
    collection: "volumes",
    draft: false,
    data: {
      title: `Integration Test Volume ${num}`,
      volumeNumber: num,
      description: "Integration test volume.",
      articles: articleIds,
      slug: `integration-test-volume-${num}`,
    },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
}

describe("scheduleVolumeNewsletter", () => {
  it("creates one campaign per published article with correct tags", async () => {
    const a1 = await createArticle("sn-article-a")
    const a2 = await createArticle("sn-article-b")
    const a3 = await createArticle("sn-article-c")
    const volume = await createVolume([a1.id, a2.id, a3.id])

    vi.mocked(listScheduledCampaigns).mockResolvedValue([])

    const result = await scheduleVolumeNewsletter(payload, volume.id)

    expect(result).toEqual({ created: 3, updated: 0 })
    expect(vi.mocked(createScheduledCampaign)).toHaveBeenCalledTimes(3)

    const calls = vi.mocked(createScheduledCampaign).mock.calls
    const articleIds = [a1.id, a2.id, a3.id]
    for (let i = 0; i < 3; i++) {
      const input = calls[i]![0]
      expect(input.tags).toContain("newsletter")
      expect(input.tags).toContain(`vol-${volume.volumeNumber}`)
      expect(input.tags).toContain(`art-${articleIds[i]}`)
    }
  })

  it("refreshes already-scheduled articles in place and creates new ones", async () => {
    const a1 = await createArticle("sn-idem-a")
    const a2 = await createArticle("sn-idem-b")
    const a3 = await createArticle("sn-idem-c")
    const volume = await createVolume([a1.id, a2.id, a3.id])

    // Pretend a1 and a2 are already scheduled (still editable in Listmonk).
    const existingCampaigns: ScheduledCampaignSummary[] = [
      {
        id: 10,
        name: `Volume ${volume.volumeNumber} · Day 1 of 3 · ${a1.title}`,
        status: "scheduled",
        sendAt: new Date("2026-02-03T12:00:00Z"),
        tags: ["newsletter", `vol-${volume.volumeNumber}`, `art-${a1.id}`],
      },
      {
        id: 11,
        name: `Volume ${volume.volumeNumber} · Day 2 of 3 · ${a2.title}`,
        status: "scheduled",
        sendAt: new Date("2026-02-04T12:00:00Z"),
        tags: ["newsletter", `vol-${volume.volumeNumber}`, `art-${a2.id}`],
      },
    ]
    vi.mocked(listScheduledCampaigns).mockResolvedValue(existingCampaigns)

    const result = await scheduleVolumeNewsletter(payload, volume.id)

    expect(result).toEqual({ created: 1, updated: 2 })

    // a3 is the only new one.
    expect(vi.mocked(createScheduledCampaign)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createScheduledCampaign).mock.calls[0]![0].tags).toContain(`art-${a3.id}`)

    // a1 and a2 are updated against their existing campaign ids, keeping send_at.
    expect(vi.mocked(updateScheduledCampaign)).toHaveBeenCalledTimes(2)
    const updateCalls = vi.mocked(updateScheduledCampaign).mock.calls.map((c) => c[0])
    expect(updateCalls).toContainEqual(
      expect.objectContaining({ campaignId: 10, sendAt: "2026-02-03T12:00:00.000Z" }),
    )
    expect(updateCalls).toContainEqual(
      expect.objectContaining({ campaignId: 11, sendAt: "2026-02-04T12:00:00.000Z" }),
    )
  })

  it("leaves campaigns that have already started sending untouched", async () => {
    const a1 = await createArticle("sn-running-a")
    const volume = await createVolume([a1.id])

    vi.mocked(listScheduledCampaigns).mockResolvedValue([
      {
        id: 30,
        name: "already sending",
        status: "running",
        sendAt: new Date("2026-02-03T12:00:00Z"),
        tags: ["newsletter", `vol-${volume.volumeNumber}`, `art-${a1.id}`],
      },
    ])

    const result = await scheduleVolumeNewsletter(payload, volume.id)

    expect(result).toEqual({ created: 0, updated: 0 })
    expect(vi.mocked(updateScheduledCampaign)).not.toHaveBeenCalled()
    expect(vi.mocked(createScheduledCampaign)).not.toHaveBeenCalled()
  })

  it("schedules the first new campaign after the latest existing campaign (queue-overlap)", async () => {
    const a1 = await createArticle("sn-queue-a")
    const volume = await createVolume([a1.id])

    // An unrelated campaign far in the future
    const futureDate = new Date("2027-06-16T12:00:00Z") // a Tuesday in EST
    const existingCampaigns: ScheduledCampaignSummary[] = [
      {
        id: 20,
        name: "Some other campaign",
        status: "scheduled",
        sendAt: futureDate,
        tags: ["newsletter", "vol-999", "art-999"],
      },
    ]
    vi.mocked(listScheduledCampaigns).mockResolvedValue(existingCampaigns)

    await scheduleVolumeNewsletter(payload, volume.id)

    expect(vi.mocked(createScheduledCampaign)).toHaveBeenCalledTimes(1)
    const input = vi.mocked(createScheduledCampaign).mock.calls[0]![0]
    // New campaign must be scheduled strictly after the existing one
    expect(new Date(input.sendAt) > futureDate).toBe(true)
  })

  it("returns zero counts and creates no campaigns when the volume has no published articles", async () => {
    const volume = await createVolume([])

    vi.mocked(listScheduledCampaigns).mockResolvedValue([])

    const result = await scheduleVolumeNewsletter(payload, volume.id)

    expect(result).toEqual({ created: 0, updated: 0 })
    expect(vi.mocked(createScheduledCampaign)).not.toHaveBeenCalled()
  })
})
