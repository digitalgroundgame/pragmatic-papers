// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/access/checkRole", () => ({ isEditor: vi.fn() }))
vi.mock("../logic", () => ({ scheduleVolumeNewsletter: vi.fn() }))

import { isEditor } from "@/access/checkRole"
import { scheduleVolumeNewsletter } from "../logic"
import { scheduleNewsletterEndpoint } from "../index"

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 1, roles: ["editor"] },
    routeParams: { id: "5" },
    payload: {
      findByID: vi.fn().mockResolvedValue({ id: 5, _status: "published", volumeNumber: 1 }),
      logger: makeLogger(),
    },
    ...overrides,
  }
}

describe("scheduleNewsletterEndpoint handler", () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it("returns 401 when req.user is null", async () => {
    vi.mocked(isEditor).mockReturnValue(false)
    const res = await scheduleNewsletterEndpoint.handler(makeReq({ user: null }) as never)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "Unauthorized" })
  })

  it("returns 401 when the user is not an editor", async () => {
    vi.mocked(isEditor).mockReturnValue(false)
    const res = await scheduleNewsletterEndpoint.handler(
      makeReq({ user: { id: 2, roles: ["reader"] } }) as never,
    )
    expect(res.status).toBe(401)
  })

  it("returns 400 when routeParams.id is non-numeric", async () => {
    vi.mocked(isEditor).mockReturnValue(true)
    const res = await scheduleNewsletterEndpoint.handler(
      makeReq({ routeParams: { id: "abc" } }) as never,
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Invalid volume id" })
  })

  it("returns 400 when routeParams is undefined", async () => {
    vi.mocked(isEditor).mockReturnValue(true)
    const res = await scheduleNewsletterEndpoint.handler(
      makeReq({ routeParams: undefined }) as never,
    )
    expect(res.status).toBe(400)
  })

  it("returns 404 when the volume is not found", async () => {
    vi.mocked(isEditor).mockReturnValue(true)
    const req = makeReq()
    ;(req.payload.findByID as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const res = await scheduleNewsletterEndpoint.handler(req as never)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: "Volume not found" })
  })

  it("returns 400 when the volume is not published", async () => {
    vi.mocked(isEditor).mockReturnValue(true)
    const req = makeReq()
    ;(req.payload.findByID as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      _status: "draft",
      volumeNumber: 1,
    })
    const res = await scheduleNewsletterEndpoint.handler(req as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/published/i)
  })

  it("returns 200 with count on success", async () => {
    vi.mocked(isEditor).mockReturnValue(true)
    vi.mocked(scheduleVolumeNewsletter).mockResolvedValue({ count: 3 })
    const res = await scheduleNewsletterEndpoint.handler(makeReq() as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: 3 })
  })

  it("returns 500 when scheduleVolumeNewsletter throws", async () => {
    vi.mocked(isEditor).mockReturnValue(true)
    vi.mocked(scheduleVolumeNewsletter).mockRejectedValue(new Error("Listmonk down"))
    const res = await scheduleNewsletterEndpoint.handler(makeReq() as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/Listmonk down/)
  })
})
