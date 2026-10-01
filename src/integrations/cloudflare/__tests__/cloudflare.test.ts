import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { cloudflareZone } from "../index"

const zone = cloudflareZone({
  id: "cloudflare-example",
  label: "Example zone",
  zoneEnv: "EXAMPLE_ZONE_ID",
  tokenEnv: "EXAMPLE_PURGE_TOKEN",
})

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("cloudflareZone", () => {
  it("names both variables when unconfigured, never a value", () => {
    vi.stubEnv("EXAMPLE_ZONE_ID", "")
    vi.stubEnv("EXAMPLE_PURGE_TOKEN", "")
    expect(integrationStatus(zone)).toMatchObject({
      service: "Cloudflare",
      target: "cloudflare:(no zone configured)",
      configured: false,
      missing: ["EXAMPLE_ZONE_ID", "EXAMPLE_PURGE_TOKEN"],
    })
  })

  it("is configured with a zone and a token, and describes itself by zone only", () => {
    vi.stubEnv("EXAMPLE_ZONE_ID", "zone123")
    vi.stubEnv("EXAMPLE_PURGE_TOKEN", "secret-token")
    const status = integrationStatus(zone)
    expect(status).toMatchObject({ configured: true, target: "cloudflare:zone/zone123" })
    expect(JSON.stringify(status)).not.toContain("secret-token")
  })

  it("posts a hostname purge to the zone with the token as a bearer", async () => {
    vi.stubEnv("EXAMPLE_ZONE_ID", "zone123")
    vi.stubEnv("EXAMPLE_PURGE_TOKEN", "secret-token")
    const fetchImpl = vi.fn(async () => reply(200, { success: true, errors: [], result: {} }))

    await zone.purge({ hosts: ["pragmaticpapers.com"] }, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone123/purge_cache",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret-token" }),
        body: JSON.stringify({ hosts: ["pragmaticpapers.com"] }),
      }),
    )
  })

  it("sends purge_everything for an everything purge", async () => {
    vi.stubEnv("EXAMPLE_ZONE_ID", "zone123")
    vi.stubEnv("EXAMPLE_PURGE_TOKEN", "t")
    const fetchImpl = vi.fn(async () => reply(200, { success: true }))
    await zone.purge({ everything: true }, { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ purge_everything: true }) }),
    )
  })

  it("throws with Cloudflare's errors, never the token", async () => {
    vi.stubEnv("EXAMPLE_ZONE_ID", "zone123")
    vi.stubEnv("EXAMPLE_PURGE_TOKEN", "secret-token")
    const fetchImpl = vi.fn(async () =>
      reply(403, { success: false, errors: [{ code: 10000, message: "Authentication error" }] }),
    )
    const purge = zone.purge({ hosts: ["a.example"] }, { fetchImpl })
    await expect(purge).rejects.toThrow(
      "Cloudflare purge failed (HTTP 403): 10000 Authentication error",
    )
    await expect(purge).rejects.not.toThrow("secret-token")
  })

  it("throws on a non-JSON error page", async () => {
    vi.stubEnv("EXAMPLE_ZONE_ID", "zone123")
    vi.stubEnv("EXAMPLE_PURGE_TOKEN", "t")
    const fetchImpl = vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502 }))
    await expect(zone.purge({ hosts: ["a.example"] }, { fetchImpl })).rejects.toThrow(
      "Cloudflare purge failed (HTTP 502)",
    )
  })

  it("refuses to call Cloudflare when unconfigured", async () => {
    vi.stubEnv("EXAMPLE_ZONE_ID", "")
    vi.stubEnv("EXAMPLE_PURGE_TOKEN", "")
    const fetchImpl = vi.fn()
    await expect(zone.purge({ hosts: ["a.example"] }, { fetchImpl })).rejects.toThrow(
      "Cloudflare purge needs EXAMPLE_ZONE_ID and EXAMPLE_PURGE_TOKEN",
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
