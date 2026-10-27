import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { cloudflareWorker } from "../index"
import { MAX_PURGE_PATHS } from "../worker"

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
    expect(String(url)).toBe("https://w.example.dev/next/revalidate-all?save=1")
    expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer s3cret" } })
  })

  it("names the paths to purge, and the shared pages, when given them", async () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "https://w.example.dev")
    vi.stubEnv("EXAMPLE_SECRET", "s3cret")
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ revalidated: true }))

    await worker.revalidateAll({ fetchImpl, paths: ["/articles/a", "/volumes/1"], shared: true })

    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.pathname).toBe("/next/revalidate-all")
    expect(url.searchParams.getAll("path")).toEqual(["/articles/a", "/volumes/1"])
    expect(url.searchParams.get("shared")).toBe("1")
    expect(url.searchParams.get("save")).toBe("1")
  })

  it("names what the save revalidated, for the Worker's own Next cache", async () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "https://w.example.dev")
    vi.stubEnv("EXAMPLE_SECRET", "s3cret")
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ revalidated: true }))

    await worker.revalidateAll({
      fetchImpl,
      paths: ["/articles/a", "/articles/feed.xml"],
      revalidated: { paths: ["/articles/a"], tags: ["articles-sitemap"] },
    })

    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.searchParams.get("next")).toBe("1")
    expect(url.searchParams.getAll("next-path")).toEqual(["/articles/a"])
    expect(url.searchParams.getAll("next-tag")).toEqual(["articles-sitemap"])
  })

  it("leaves the Worker to revalidate everything when the save didn't say, or said too much", async () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "https://w.example.dev")
    vi.stubEnv("EXAMPLE_SECRET", "s3cret")
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ revalidated: true }))
    const tags = Array.from({ length: MAX_PURGE_PATHS + 1 }, (_, i) => `tag${i}`)

    await worker.revalidateAll({ fetchImpl, paths: ["/articles/a"] })
    await worker.revalidateAll({
      fetchImpl,
      paths: ["/articles/a"],
      revalidated: { paths: [], tags },
    })

    for (const [called] of fetchImpl.mock.calls) {
      expect(new URL(String(called)).searchParams.has("next")).toBe(false)
    }
  })

  it(`purges everything rather than name more than ${MAX_PURGE_PATHS} paths`, async () => {
    vi.stubEnv("EXAMPLE_WORKER_URL", "https://w.example.dev")
    vi.stubEnv("EXAMPLE_SECRET", "s3cret")
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ revalidated: true }))
    const paths = Array.from({ length: MAX_PURGE_PATHS + 1 }, (_, i) => `/articles/a${i}`)

    await worker.revalidateAll({ fetchImpl, paths, shared: true })

    expect(String(fetchImpl.mock.calls[0]![0])).toBe(
      "https://w.example.dev/next/revalidate-all?save=1",
    )
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
