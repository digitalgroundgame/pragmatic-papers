import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { POST } from "../route"

const DSN = "https://key@o1.ingest.sentry.io/2"
const INGEST = "https://o1.ingest.sentry.io/api/2/envelope/"

const envelope = (dsn: string | undefined) =>
  `${JSON.stringify({ event_id: "abc", dsn })}\n{"type":"event"}\n{"message":"boom"}`

const request = (body: string): Request =>
  new Request("http://localhost/monitoring", { method: "POST", body })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubEnv("SENTRY_DSN", DSN)
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(
    new Response("{}", {
      status: 200,
      headers: { "X-Sentry-Rate-Limits": "60::organization", "X-Other": "dropped" },
    }),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe("POST /monitoring", () => {
  it("forwards an envelope for our DSN to its project's ingest endpoint", async () => {
    const body = envelope(DSN)
    const response = await POST(request(body))

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      INGEST,
      expect.objectContaining({ method: "POST" }),
    )
    const sent = fetchMock.mock.calls[0]?.[1]?.body as Uint8Array
    expect(new TextDecoder().decode(sent)).toBe(body)
  })

  it("passes on Sentry's rate limits and nothing else", async () => {
    const response = await POST(request(envelope(DSN)))

    expect(response.headers.get("x-sentry-rate-limits")).toBe("60::organization")
    expect(response.headers.get("x-other")).toBeNull()
  })

  it("passes on Sentry's status", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }))

    expect((await POST(request(envelope(DSN)))).status).toBe(429)
  })

  it.each([
    ["another project", "https://key@o1.ingest.sentry.io/3"],
    ["another organisation", "https://key@o9.ingest.sentry.io/2"],
    ["no DSN", undefined],
  ])("refuses an envelope for %s", async (_, dsn) => {
    const response = await POST(request(envelope(dsn)))

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses a body over 1 MB without forwarding it", async () => {
    const response = await POST(request(envelope(DSN) + "x".repeat(1024 * 1024)))

    expect(response.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses a body that isn't an envelope", async () => {
    expect((await POST(request("not json"))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("answers 404 when this deployment doesn't report to Sentry", async () => {
    vi.stubEnv("SENTRY_DSN", "")

    expect((await POST(request(envelope(DSN)))).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("answers 502 when Sentry can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    expect((await POST(request(envelope(DSN)))).status).toBe(502)
  })
})
