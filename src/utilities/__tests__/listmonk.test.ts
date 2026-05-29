import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createScheduledCampaign,
  listScheduledCampaigns,
  sendTransactional,
  subscribeMember,
} from "../listmonk"

const ENV_DEFAULTS = {
  LISTMONK_BASE_URL: "https://listmonk.example.com",
  LISTMONK_API_USER: "apiuser",
  LISTMONK_API_TOKEN: "apitoken",
  LISTMONK_NEWSLETTER_LIST_ID: "42",
  LISTMONK_NEWSLETTER_LIST_UUID: "list-uuid-abc",
  NEWSLETTER_FROM_EMAIL: "newsletter@example.com",
}

function stubEnv() {
  for (const [k, v] of Object.entries(ENV_DEFAULTS)) vi.stubEnv(k, v)
}

function mockListmonkFetch(data: unknown, status = 200) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(String(status)),
  } as Response)
}

describe("subscribeMember", () => {
  beforeEach(stubEnv)
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("POSTs to /api/public/subscription with the list UUID", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true } as Response)
    await subscribeMember({ email: "test@example.com" })
    const [url, init] = spy.mock.calls[0]!
    expect(String(url)).toContain("/api/public/subscription")
    expect(init?.method).toBe("POST")
    const body = JSON.parse(init!.body as string)
    expect(body.email).toBe("test@example.com")
    expect(body.list_uuids).toContain("list-uuid-abc")
  })

  it("throws when Listmonk returns non-2xx", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("internal error"),
    } as Response)
    await expect(subscribeMember({ email: "x@x.com" })).rejects.toThrow("500")
  })
})

describe("createScheduledCampaign", () => {
  beforeEach(stubEnv)
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("makes two fetch calls and returns the campaign id from the first", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { id: 7, name: "test", status: "draft", send_at: null, tags: [] },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 7,
              name: "test",
              status: "scheduled",
              send_at: "2026-01-15T12:00:00Z",
              tags: [],
            },
          }),
      } as Response)

    const id = await createScheduledCampaign({
      name: "Test Campaign",
      subject: "Hello",
      bodyHtml: "<p>hi</p>",
      sendAt: "2026-01-15T12:00:00Z",
      tags: ["newsletter", "vol-1", "art-5"],
    })

    expect(id).toBe(7)
    expect(spy).toHaveBeenCalledTimes(2)

    const [, secondInit] = spy.mock.calls[1]!
    expect(JSON.parse(secondInit!.body as string)).toEqual({ status: "scheduled" })
  })
})

describe("listScheduledCampaigns", () => {
  beforeEach(stubEnv)
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("filters out campaigns with null send_at", async () => {
    mockListmonkFetch({
      results: [
        { id: 1, name: "Has date", status: "scheduled", send_at: "2026-01-15T12:00:00Z", tags: [] },
        { id: 2, name: "No date", status: "running", send_at: null, tags: [] },
      ],
    })
    const result = await listScheduledCampaigns()
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(1)
  })

  it("maps null tags to an empty array", async () => {
    mockListmonkFetch({
      results: [
        {
          id: 1,
          name: "Campaign",
          status: "scheduled",
          send_at: "2026-01-15T12:00:00Z",
          tags: null,
        },
      ],
    })
    const result = await listScheduledCampaigns()
    expect(result[0]!.tags).toEqual([])
  })

  it("parses send_at string into a Date", async () => {
    mockListmonkFetch({
      results: [
        {
          id: 1,
          name: "Campaign",
          status: "scheduled",
          send_at: "2026-01-15T12:00:00.000Z",
          tags: [],
        },
      ],
    })
    const result = await listScheduledCampaigns()
    expect(result[0]!.sendAt).toBeInstanceOf(Date)
    expect(result[0]!.sendAt.toISOString()).toBe("2026-01-15T12:00:00.000Z")
  })
})

describe("sendTransactional", () => {
  beforeEach(stubEnv)
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("throws when LISTMONK_WELCOME_TX_TEMPLATE_ID is not set", async () => {
    await expect(
      sendTransactional({ email: "x@x.com", bodyHtml: "<p>hi</p>", subject: "Hi" }),
    ).rejects.toThrow("LISTMONK_WELCOME_TX_TEMPLATE_ID is not set")
  })

  it("sends the template id and pre-rendered body", async () => {
    vi.stubEnv("LISTMONK_WELCOME_TX_TEMPLATE_ID", "99")
    const spy = mockListmonkFetch(null)
    await sendTransactional({ email: "x@x.com", bodyHtml: "<p>hi</p>", subject: "Hi" })
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string)
    expect(body.template_id).toBe(99)
    expect(body.data.body).toBe("<p>hi</p>")
    expect(body.subscriber_email).toBe("x@x.com")
  })
})
