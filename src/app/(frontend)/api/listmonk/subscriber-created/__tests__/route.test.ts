// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: vi.fn() }))
vi.mock("@react-email/render", () => ({ render: vi.fn().mockResolvedValue("<html/>") }))
vi.mock("@/emails/MidDripWelcome", () => ({ MidDripWelcomeEmail: vi.fn() }))
vi.mock("@/utilities/listmonk", () => ({
  listScheduledCampaigns: vi.fn(),
  sendTransactional: vi.fn(),
}))

import { listScheduledCampaigns } from "@/utilities/listmonk"
import { POST } from "../route"

const SECRET = "webhook-secret-abc"

function makeReq(body: unknown, secret?: string) {
  return new Request("http://localhost/api/listmonk/subscriber-created", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(secret !== undefined ? { "x-webhook-secret": secret } : {}),
    },
  })
}

/** Constructs a ScheduledCampaignSummary compatible with what listScheduledCampaigns returns. */
function campaign(name: string, dayOffset = 1) {
  return {
    id: Math.floor(Math.random() * 1000),
    name,
    sendAt: new Date(Date.now() + dayOffset * 86400_000),
    tags: [],
  }
}

describe("POST /api/listmonk/subscriber-created", () => {
  beforeEach(() => {
    vi.stubEnv("LISTMONK_WEBHOOK_SECRET", SECRET)
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 500 when LISTMONK_WEBHOOK_SECRET is not configured", async () => {
    vi.stubEnv("LISTMONK_WEBHOOK_SECRET", "")
    const res = await POST(makeReq({ subscriber: { email: "x@x.com" } }, SECRET) as never)
    expect(res.status).toBe(500)
  })

  it("returns 401 for a wrong webhook secret", async () => {
    const res = await POST(makeReq({ subscriber: { email: "x@x.com" } }, "wrong-secret") as never)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/listmonk/subscriber-created", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json", "x-webhook-secret": SECRET },
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 when subscriber.email is missing", async () => {
    vi.mocked(listScheduledCampaigns).mockResolvedValue([])
    const res = await POST(makeReq({ subscriber: {} }, SECRET) as never)
    expect(res.status).toBe(400)
  })

  it("returns no-active-drip when no campaigns are scheduled", async () => {
    vi.mocked(listScheduledCampaigns).mockResolvedValue([])
    const res = await POST(makeReq({ subscriber: { email: "new@example.com" } }, SECRET) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, action: "no-active-drip" })
  })

  it("returns no-recognizable-campaigns when scheduled campaigns have unrecognizable names", async () => {
    vi.mocked(listScheduledCampaigns).mockResolvedValue([
      campaign("Some other campaign without the expected pattern"),
    ])
    const res = await POST(makeReq({ subscriber: { email: "new@example.com" } }, SECRET) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, action: "no-recognizable-campaigns" })
  })

  it("returns drip-not-started when Day 1 of the active volume is still scheduled", async () => {
    // "Day 1" means dayIndex = 0 → minRemainingDay === 0 → drip not started
    vi.mocked(listScheduledCampaigns).mockResolvedValue([
      campaign("Volume 3 · Day 1 of 5 · First Article"),
      campaign("Volume 3 · Day 2 of 5 · Second Article", 2),
    ])
    const res = await POST(makeReq({ subscriber: { email: "new@example.com" } }, SECRET) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, action: "drip-not-started" })
  })
})
