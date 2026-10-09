import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { cloudflareWorker } from "../index"

const worker = cloudflareWorker({
  id: "worker-example",
  label: "Example Worker",
  urlEnv: "EXAMPLE_WORKER_URL",
  secretEnv: "EXAMPLE_SECRET",
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("cloudflareWorker", () => {
  it("names both variables when unconfigured, and describes itself by URL only", () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "")
    vi.stubEnv("EXAMPLE_SECRET", "")
    expect(integrationStatus(worker)).toMatchObject({
      target: "worker:(no URL configured)",
      configured: false,
      missing: ["EXAMPLE_WORKER_URL", "EXAMPLE_SECRET"],
    })

    vi.stubEnv("EXAMPLE_WORKER_URL", "https://w.example.dev")
    vi.stubEnv("EXAMPLE_SECRET", "s3cret")
    const status = integrationStatus(worker)
    expect(status).toMatchObject({ configured: true, target: "worker:https://w.example.dev" })
    expect(JSON.stringify(status)).not.toContain("s3cret")
  })

  it("posts to /next/revalidate-all with the secret as a bearer", async () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "https://w.example.dev/")
    vi.stubEnv("EXAMPLE_SECRET", "s3cret")
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ revalidated: true }))

    await worker.revalidateAll({ fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe("https://w.example.dev/next/revalidate-all")
    expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer s3cret" } })
  })

  it("throws with the status, never the secret, when the Worker refuses", async () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "https://w.example.dev")
    vi.stubEnv("EXAMPLE_SECRET", "s3cret")
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 401 }))

    const error = await worker.revalidateAll({ fetchImpl }).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe("Worker revalidation failed (HTTP 401)")
  })

  it("throws without calling out when unconfigured", async () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "")
    const fetchImpl = vi.fn()
    await expect(worker.revalidateAll({ fetchImpl })).rejects.toThrow("EXAMPLE_WORKER_URL")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
