import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loadNewsletterOverview } from "../load"

const ENV = {
  LISTMONK_BASE_URL: "https://listmonk.example.com/",
  LISTMONK_API_USER: "apiuser",
  LISTMONK_API_TOKEN: "apitoken",
  LISTMONK_NEWSLETTER_LIST_ID: "42",
  LISTMONK_NEWSLETTER_LIST_UUID: "list-uuid",
  NEWSLETTER_FROM_EMAIL: "newsletter@example.com",
}

function respond(status: number, data: unknown): Response {
  return {
    ok: status < 300,
    status,
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(""),
  } as Response
}

describe("loadNewsletterOverview", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("reports what's missing without calling Listmonk when it isn't configured", async () => {
    vi.stubEnv("LISTMONK_API_TOKEN", "")
    const fetchSpy = vi.spyOn(global, "fetch")
    await expect(loadNewsletterOverview()).resolves.toEqual({
      connected: false,
      missing: ["LISTMONK_API_TOKEN"],
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("keeps the parts it could read when the API user is refused one", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname
      if (path === "/api/lists/42") return respond(200, { name: "Newsletter", subscriber_count: 1 })
      if (path === "/api/subscribers") return respond(403, null)
      return respond(500, null)
    })
    const overview = await loadNewsletterOverview()
    expect(overview).toMatchObject({
      connected: true,
      adminUrl: "https://listmonk.example.com/admin",
      list: { ok: true, data: { total: 1 } },
      signups: { ok: false, reason: "forbidden" },
      campaigns: { ok: false, reason: "error" },
    })
  })
})
