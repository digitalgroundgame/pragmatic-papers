import { afterEach, describe, expect, it, vi } from "vitest"

import { GET } from "../route"

describe("/next/version", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("names the commit Coolify deployed, uncached", async () => {
    vi.stubEnv("SOURCE_COMMIT", "0123abcd")

    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ commit: "0123abcd" })
  })

  it("answers null where nothing sets the commit", async () => {
    vi.stubEnv("SOURCE_COMMIT", "")

    await expect(GET().json()).resolves.toEqual({ commit: null })
  })
})
