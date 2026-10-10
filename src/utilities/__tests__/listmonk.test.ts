import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createScheduledCampaign,
  getNewsletterListStats,
  ListmonkError,
  listRecentCampaigns,
  listRecentSignups,
  listScheduledCampaigns,
  missingListmonkEnv,
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
            data: {
              id: 7,
              name: "test",
              status: "draft",
              send_at: null,
              tags: [],
              lists: [{ id: 42, name: "Newsletter" }],
            },
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
              lists: [{ id: 42, name: "Newsletter" }],
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

    const [, createInit] = spy.mock.calls[0]!
    expect(JSON.parse(createInit!.body as string).lists).toEqual([42])

    const [, secondInit] = spy.mock.calls[1]!
    expect(JSON.parse(secondInit!.body as string)).toEqual({ status: "scheduled" })
  })

  it("throws when Listmonk drops the list (RBAC) instead of scheduling an empty campaign", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          // List 42 was silently filtered out by FilterListsByPerm.
          data: { id: 7, name: "test", status: "draft", send_at: null, tags: [], lists: [] },
        }),
    } as Response)

    await expect(
      createScheduledCampaign({
        name: "Test Campaign",
        subject: "Hello",
        bodyHtml: "<p>hi</p>",
        sendAt: "2026-01-15T12:00:00Z",
      }),
    ).rejects.toThrow("without list 42 attached")

    // Must not proceed to the status PUT — the campaign should never be scheduled.
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe("readConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("throws when a required env var is missing", async () => {
    stubEnv()
    vi.stubEnv("LISTMONK_BASE_URL", "")
    await expect(listScheduledCampaigns()).rejects.toThrow(
      "Missing required env var: LISTMONK_BASE_URL",
    )
  })

  it("throws when LISTMONK_NEWSLETTER_LIST_ID is not a positive integer", async () => {
    stubEnv()
    vi.stubEnv("LISTMONK_NEWSLETTER_LIST_ID", "Newsletter")
    await expect(listScheduledCampaigns()).rejects.toThrow(
      'LISTMONK_NEWSLETTER_LIST_ID must be a positive integer, got: "Newsletter"',
    )
  })
})

describe("listmonkFetch error path", () => {
  beforeEach(stubEnv)
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("falls back to empty string when res.text() rejects", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.reject(new Error("stream closed")),
    } as Response)
    await expect(listScheduledCampaigns()).rejects.toThrow("503")
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

  it("sends status as repeated query params, not a comma-joined value", async () => {
    const spy = mockListmonkFetch({ results: [] })
    await listScheduledCampaigns()
    const url = new URL(String(spy.mock.calls[0]![0]))
    expect(url.searchParams.getAll("status")).toEqual(["scheduled", "running"])
    expect(url.search).not.toContain("scheduled%2Crunning")
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

describe("missingListmonkEnv", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("names the variables this environment lacks", () => {
    stubEnv()
    vi.stubEnv("LISTMONK_API_TOKEN", "")
    expect(missingListmonkEnv()).toEqual(["LISTMONK_API_TOKEN"])
  })
})

describe("newsletter dashboard reads", () => {
  beforeEach(stubEnv)
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("throws a ListmonkError carrying the status when the API user is refused", async () => {
    mockListmonkFetch(null, 403)
    const error = await getNewsletterListStats().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ListmonkError)
    expect(error).toHaveProperty("status", 403)
  })

  it("reads the list's counts per subscription status", async () => {
    const spy = mockListmonkFetch({
      name: "Newsletter",
      subscriber_count: 10,
      subscriber_statuses: { confirmed: 7, unconfirmed: 2, unsubscribed: 1 },
    })
    await expect(getNewsletterListStats()).resolves.toEqual({
      name: "Newsletter",
      total: 10,
      confirmed: 7,
      unconfirmed: 2,
      unsubscribed: 1,
    })
    expect(new URL(String(spy.mock.calls[0]![0])).pathname).toBe("/api/lists/42")
  })

  it("counts zero for statuses an older Listmonk doesn't report", async () => {
    mockListmonkFetch({ name: "Newsletter", subscriber_count: 3 })
    await expect(getNewsletterListStats()).resolves.toMatchObject({ total: 3, confirmed: 0 })
  })

  it("asks for the newest subscribers on the newsletter list, with their status on it", async () => {
    const spy = mockListmonkFetch({
      results: [
        {
          id: 5,
          email: "a@example.com",
          status: "enabled",
          created_at: "2026-10-10T18:00:00Z",
          lists: [
            { id: 9, subscription_status: "confirmed" },
            { id: 42, subscription_status: "unconfirmed" },
          ],
        },
      ],
    })
    const signups = await listRecentSignups(8)
    expect(signups).toEqual([
      {
        id: 5,
        email: "a@example.com",
        createdAt: "2026-10-10T18:00:00Z",
        subscriptionStatus: "unconfirmed",
        status: "enabled",
      },
    ])
    const url = new URL(String(spy.mock.calls[0]![0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({
      list_id: "42",
      order_by: "created_at",
      order: "desc",
      per_page: "8",
    })
  })

  it("treats a null results page as no signups", async () => {
    mockListmonkFetch({ results: null })
    await expect(listRecentSignups(8)).resolves.toEqual([])
  })

  it("keeps only the newsletter list's campaigns, newest first, up to the limit", async () => {
    const campaign = (id: number, listId: number) => ({
      id,
      name: `Campaign ${id}`,
      subject: `Subject ${id}`,
      status: "finished",
      send_at: "2026-10-01T15:00:00Z",
      started_at: "2026-10-01T15:00:05Z",
      tags: [],
      lists: [{ id: listId, name: "list" }],
      sent: 100,
      to_send: 100,
      views: 40,
      clicks: 5,
      bounces: 1,
    })
    const spy = mockListmonkFetch({
      results: [campaign(3, 42), campaign(2, 7), campaign(1, 42), campaign(0, 42)],
    })
    const campaigns = await listRecentCampaigns(2)
    expect(campaigns.map((c) => c.id)).toEqual([3, 1])
    expect(campaigns[0]).toMatchObject({
      subject: "Subject 3",
      sendAt: "2026-10-01T15:00:05Z",
      sent: 100,
      views: 40,
      clicks: 5,
    })
    expect(new URL(String(spy.mock.calls[0]![0])).searchParams.get("no_body")).toBe("true")
  })
})
