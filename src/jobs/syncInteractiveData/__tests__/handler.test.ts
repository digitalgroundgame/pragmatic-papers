import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag, syncInteractive } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  syncInteractive: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidateTag }))
vi.mock("../logic", () => ({ syncInteractive }))

import { syncInteractiveDataTask } from ".."
import type { SyncOutcome } from "../logic"

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const find = vi.fn()

interface Row {
  id: number
  slug: string | null
}

async function run(interactives: Row[], input: Record<string, unknown> = {}) {
  find.mockResolvedValue({ docs: interactives })
  const handler = syncInteractiveDataTask.handler as (args: unknown) => Promise<{
    output: Record<"synced" | "unchanged" | "skipped" | "failed", number>
  }>
  return handler({ input, req: { payload: { find, logger: log } } })
}

const synced = (status: "draft" | "published"): SyncOutcome => ({
  outcome: "synced",
  status,
  sourceVersion: "v1",
  contentHash: "h",
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("syncInteractiveDataTask", () => {
  it("syncs every interactive, drafts included, and counts each outcome", async () => {
    syncInteractive
      .mockResolvedValueOnce(synced("draft"))
      .mockResolvedValueOnce({ outcome: "unchanged", reason: "content" })
      .mockResolvedValueOnce({ outcome: "skipped", reason: "feed disabled" })
      .mockResolvedValueOnce({ outcome: "failed", errors: ["bad"] })

    const { output } = await run([1, 2, 3, 4].map((id) => ({ id, slug: `i${id}` })))

    expect(output).toEqual({ synced: 1, unchanged: 1, skipped: 1, failed: 1 })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "interactives", where: {}, draft: true, limit: 0 }),
    )
  })

  it("narrows to one interactive and passes force through when asked", async () => {
    syncInteractive.mockResolvedValue({ outcome: "unchanged", reason: "source-version" })
    const row = { id: 4, slug: "courts" }
    await run([row], { interactiveId: 4, force: true })

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { equals: 4 } } }))
    expect(syncInteractive).toHaveBeenCalledWith(expect.anything(), row, { log, force: true })
  })

  it("keeps going past a feed that throws, and counts it failed", async () => {
    syncInteractive
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(synced("draft"))

    const { output } = await run([
      { id: 1, slug: "a" },
      { id: 2, slug: "b" },
    ])

    expect(output).toMatchObject({ synced: 1, failed: 1 })
    expect(log.error).toHaveBeenCalledWith("[interactive-sync:a] socket hang up")
  })

  it("drops the page's data cache only for a snapshot published straight to readers", async () => {
    syncInteractive
      .mockResolvedValueOnce(synced("published"))
      .mockResolvedValueOnce(synced("draft"))

    await run([
      { id: 1, slug: "courts" },
      { id: 2, slug: "other" },
    ])

    expect(revalidateTag.mock.calls).toEqual([["interactive:1", "max"]])
  })

  it("still tags an interactive with no slug", async () => {
    syncInteractive.mockResolvedValue(synced("published"))
    await run([{ id: 1, slug: null }])
    expect(revalidateTag).toHaveBeenCalledWith("interactive:1", "max")
  })

  it("still counts a publish whose revalidation throws outside a request scope", async () => {
    syncInteractive.mockResolvedValue(synced("published"))
    revalidateTag.mockImplementationOnce(() => {
      throw new Error("static generation store missing")
    })

    const { output } = await run([{ id: 1, slug: "courts" }])

    expect(output.synced).toBe(1)
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("published but revalidation failed: static generation store missing"),
    )
  })
})
