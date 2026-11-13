import { beforeEach, describe, expect, it, vi } from "vitest"

import type { WhipCountData } from "@/interactives/whip-count/model"
import { whipCountData } from "@/stories/fixtures/whipCount"

const { find, update, isExperimentEnabled } = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(async () => ({})),
  isExperimentEnabled: vi.fn(async () => true),
}))
const payload = { find, update, logger: { info: vi.fn() } }

vi.mock("@/data/payload", () => ({ getPayloadClient: async () => payload }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({ isExperimentEnabled }))

const { Locked } = await import("payload")
const { POST } = await import("../route")

const copy = (): WhipCountData => JSON.parse(JSON.stringify(whipCountData)) as WhipCountData

const push = (body: unknown, authorization = "Bearer t0ken"): Promise<Response> =>
  POST(
    new Request("http://localhost/next/whip-counts/leader", {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "leader" }) },
  )

describe("POST /next/whip-counts/[slug]", () => {
  beforeEach(() => {
    vi.stubEnv("WHIP_COUNT_PUSH_TOKEN", "t0ken")
    vi.clearAllMocks()
    isExperimentEnabled.mockResolvedValue(true)
    find.mockResolvedValue({
      docs: [{ id: 7, autoPublish: false, _status: "published", data: copy() }],
    })
  })

  it("refuses a request without the token, and any request while the token is unset", async () => {
    expect((await push(copy(), "Bearer wrong")).status).toBe(401)
    vi.stubEnv("WHIP_COUNT_PUSH_TOKEN", undefined)
    expect((await push(copy(), "Bearer undefined")).status).toBe(401)
    expect(find).not.toHaveBeenCalled()
  })

  it("is not there while the experiment is off, or for a slug with no document", async () => {
    isExperimentEnabled.mockResolvedValue(false)
    expect((await push(copy())).status).toBe(404)
    isExperimentEnabled.mockResolvedValue(true)
    find.mockResolvedValue({ docs: [] })
    expect((await push(copy())).status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })

  it("says what is wrong with a count it can't read", async () => {
    const response = await push({ ...copy(), asOf: "today" })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: '"asOf" must be a date like 2026-11-13.',
    })
    expect((await push("not json")).status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("writes nothing when the count is the one the document holds", async () => {
    await expect((await push(copy())).json()).resolves.toEqual({ status: "unchanged" })
    expect(update).not.toHaveBeenCalled()
  })

  it("saves a changed count as a draft, keeping the editors' blocs and tags", async () => {
    const pushed = copy()
    const okafor = pushed.members.find((m) => m.name === "Sam Okafor")!
    Object.assign(okafor, { stance: "backs", candidate: "ortiz", bloc: "Someone else's label" })

    await expect((await push(pushed)).json()).resolves.toEqual({ status: "draft" })
    expect(update).toHaveBeenCalledTimes(1)
    const [args] = update.mock.calls[0] as unknown as [
      { id: number; draft: boolean; data: { data: WhipCountData; _status?: string } },
    ]
    expect(args).toMatchObject({ collection: "whip-counts", id: 7, draft: true })
    expect(args.data._status).toBeUndefined()
    expect(args.data.data.members.find((m) => m.name === "Sam Okafor")).toMatchObject({
      stance: "backs",
      candidate: "ortiz",
      bloc: "Moderate",
    })
  })

  it("publishes it when the document asks for that", async () => {
    find.mockResolvedValue({
      docs: [{ id: 7, autoPublish: true, _status: "published", data: copy() }],
    })
    const pushed = { ...copy(), asOf: "2026-11-14" }
    await expect((await push(pushed)).json()).resolves.toEqual({ status: "published" })
    expect(update.mock.calls[0]).toMatchObject([{ draft: false, data: { _status: "published" } }])
  })

  it("saves a draft, not publishing, while an editor has unpublished changes", async () => {
    // Publishing starts from the newest version, which is the editor's draft.
    find.mockResolvedValue({
      docs: [{ id: 7, autoPublish: true, _status: "draft", data: copy() }],
    })
    const pushed = { ...copy(), asOf: "2026-11-14" }
    await expect((await push(pushed)).json()).resolves.toEqual({
      status: "draft",
      reason: "An editor has unpublished changes; publish them together.",
    })
    expect(update.mock.calls[0]).toMatchObject([{ draft: true }])
    expect(
      (update.mock.calls[0] as unknown as [{ data: { _status?: string } }])[0].data._status,
    ).toBeUndefined()
  })

  it("leaves a count an editor has open alone, for the next push", async () => {
    update.mockRejectedValueOnce(new Locked("Document with ID 7 is currently locked"))
    const response = await push({ ...copy(), asOf: "2026-11-14" })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ status: "locked" })
    expect(update.mock.calls[0]).toMatchObject([{ overrideLock: false }])
  })

  it("lets any other failure through", async () => {
    update.mockRejectedValueOnce(new Error("database is down"))
    await expect(push({ ...copy(), asOf: "2026-11-14" })).rejects.toThrow("database is down")
  })
})
