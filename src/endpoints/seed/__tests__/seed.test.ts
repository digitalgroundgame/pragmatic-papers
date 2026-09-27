import { revalidatePath } from "next/cache"
import type { Payload } from "payload"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { seed } from "../index"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

// Collections and globals whose hooks call revalidatePath/revalidateTag. A
// write to one of these without `disableRevalidate` crashes `pnpm dev:db-seed`.
const REVALIDATING = new Set([
  "articles",
  "volumes",
  "pages",
  "users",
  "merch",
  "redirects",
  "header",
  "footer",
])

interface Write {
  op: "create" | "update" | "delete" | "updateGlobal"
  target: string
  context?: Record<string, unknown>
  data?: Record<string, unknown>
}

type Doc = Record<string, unknown> & { id: number }

// An in-memory Payload that records every write and answers reads from what
// was written, enough for the whole seed to run without a database.
function createRecordingPayload() {
  const writes: Write[] = []
  const store = new Map<string, Doc[]>()
  let nextId = 1

  const docsIn = (collection: string) => store.get(collection) ?? []
  const matches = (doc: Doc, where?: Record<string, { equals?: unknown }>) =>
    Object.entries(where ?? {}).every(
      ([field, condition]) => condition?.equals === undefined || doc[field] === condition.equals,
    )

  const payload = {
    create: vi.fn(async ({ collection, data, context }) => {
      writes.push({ op: "create", target: collection, context, data })
      const doc = { ...data, id: nextId++ }
      store.set(collection, [...docsIn(collection), doc])
      return doc
    }),
    update: vi.fn(async ({ collection, id, data, context }) => {
      writes.push({ op: "update", target: collection, context, data })
      return { ...data, id }
    }),
    delete: vi.fn(async ({ collection, context }) => {
      writes.push({ op: "delete", target: collection, context })
      store.delete(collection)
      return { docs: [], errors: [] }
    }),
    updateGlobal: vi.fn(async ({ slug, data, context }) => {
      writes.push({ op: "updateGlobal", target: slug, context, data })
      return data
    }),
    find: vi.fn(async ({ collection, where }) => ({
      docs: docsIn(collection).filter((doc) => matches(doc, where)),
    })),
    findByID: vi.fn(async ({ collection, id }) => docsIn(collection).find((doc) => doc.id === id)),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }

  return { payload: payload as unknown as Payload, writes }
}

describe("seed", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([0]), { status: 200 })),
    )
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes disableRevalidate to every write that reaches a revalidating hook", async () => {
    const { payload, writes } = createRecordingPayload()

    await seed(payload, undefined, { disableRevalidate: true })

    const unguarded = writes
      .filter((write) => REVALIDATING.has(write.target) && !write.context?.disableRevalidate)
      .map(({ op, target }) => `${op} ${target}`)
    expect(unguarded).toEqual([])
    expect(writes.some((write) => write.target === "articles")).toBe(true)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("still revalidates the authors pages when called without a context", async () => {
    const { payload } = createRecordingPayload()

    await seed(payload)

    expect(revalidatePath).toHaveBeenCalledWith("/authors")
    expect(revalidatePath).toHaveBeenCalledWith("/authors/[slug]", "page")
  })

  it("empties the recommendation rankings before deleting articles", async () => {
    const { payload, writes } = createRecordingPayload()

    await seed(payload, undefined, { disableRevalidate: true })

    const clearRankings = writes.findIndex(
      (write) =>
        write.op === "updateGlobal" &&
        write.target === "article-recommendations" &&
        Array.isArray(write.data?.rankings) &&
        write.data.rankings.length === 0,
    )
    const deleteArticles = writes.findIndex(
      (write) => write.op === "delete" && write.target === "articles",
    )
    expect(clearRankings).toBeGreaterThanOrEqual(0)
    expect(clearRankings).toBeLessThan(deleteArticles)
  })

  it("reports each step's progress", async () => {
    const { payload } = createRecordingPayload()
    const onProgress = vi.fn()

    await seed(payload, onProgress, { disableRevalidate: true })

    expect(onProgress).toHaveBeenCalledWith("Clearing existing data...", 1, 11)
    expect(onProgress).toHaveBeenLastCalledWith("Seeding article recommendations...", 11, 11)
  })

  it("names the step that failed", async () => {
    const { payload } = createRecordingPayload()
    vi.mocked(payload.updateGlobal).mockRejectedValueOnce(new Error("boom"))

    await expect(seed(payload, undefined, { disableRevalidate: true })).rejects.toThrow(
      'Seed step "Clearing existing data..." failed: boom',
    )
  })
})
