import type { JSONField, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

const { revalidateForReaders, readersChange } = vi.hoisted(() => ({
  revalidateForReaders: vi.fn(),
  readersChange: vi.fn(),
}))
vi.mock("@/hooks/revalidateForReaders", () => ({ revalidateForReaders }))
vi.mock("@/utilities/readersCopy", () => ({
  readersChange,
  rememberReadersCopy: vi.fn(),
}))

const { WhipCounts } = await import("../index")
const { revalidateWhipCount, revalidateWhipCountDelete } =
  await import("../hooks/revalidateWhipCount")
const { whipCountPath } = await import("../tag")

const logger = { info: vi.fn() }
const req = (context: Record<string, unknown> = {}): PayloadRequest =>
  ({ context, payload: { logger } }) as unknown as PayloadRequest

describe("the whip-counts collection", () => {
  it("is filed under Interactives, with drafts", () => {
    expect(WhipCounts.admin?.group).toBe("Interactives")
    expect(WhipCounts.versions).toMatchObject({ drafts: { autosave: true }, maxPerDoc: 50 })
  })

  it("accepts a count the page can read, and says what is wrong with one it can't", () => {
    const field = WhipCounts.fields.find((f): f is JSONField => "name" in f && f.name === "data")!
    const validate = field.validate as unknown as (value: unknown) => true | string
    expect(validate(JSON.parse(JSON.stringify(whipCountData)))).toBe(true)
    expect(validate({ schema: "nope" })).toContain('"schema" must be')
    expect(validate(undefined)).toBe("The data must be a JSON object.")
  })

  it("previews a document at its page", () => {
    expect(whipCountPath("leader")).toBe("/interactives/whip-counts/leader")
    const preview = WhipCounts.admin?.preview as unknown as (
      data: unknown,
      options: { req: PayloadRequest },
    ) => string | null
    const livePreview = WhipCounts.admin?.livePreview?.url as unknown as (args: {
      data: unknown
      req: PayloadRequest
    }) => string | null
    for (const url of [
      preview({ slug: "leader" }, { req: req() }),
      livePreview({ data: { slug: "leader" }, req: req() }),
    ]) {
      const params = new URL(url!, "http://localhost").searchParams
      expect(params.get("collection")).toBe("whip-counts")
      expect(params.get("path")).toBe("/interactives/whip-counts/leader")
    }
  })
})

describe("revalidateWhipCount", () => {
  const doc = { id: 3, slug: "leader" }
  const run = (context?: Record<string, unknown>) =>
    revalidateWhipCount({ doc, req: req(context) } as never)

  beforeEach(() => vi.clearAllMocks())

  it("purges the page when readers' copy changed", async () => {
    readersChange.mockResolvedValue({ before: { slug: "leader" }, after: { slug: "leader" } })
    await expect(run()).resolves.toBe(doc)
    expect(revalidateForReaders).toHaveBeenCalledTimes(1)
    expect(revalidateForReaders).toHaveBeenCalledWith(logger, "whip count leader", {
      purgeOnly: ["/interactives/whip-counts/leader"],
    })
  })

  it("purges the old page too when the slug moved", async () => {
    readersChange.mockResolvedValue({ before: { slug: "old" }, after: { slug: "leader" } })
    await run()
    expect(revalidateForReaders.mock.calls.map(([, , what]) => what)).toEqual([
      { purgeOnly: ["/interactives/whip-counts/leader"] },
      { purgeOnly: ["/interactives/whip-counts/old"] },
    ])
  })

  it("does nothing for a save readers can't see, or when asked not to", async () => {
    readersChange.mockResolvedValue(null)
    await run()
    await run({ disableRevalidate: true })
    expect(revalidateForReaders).not.toHaveBeenCalled()
    expect(readersChange).toHaveBeenCalledTimes(1)
  })
})

describe("revalidateWhipCountDelete", () => {
  beforeEach(() => vi.clearAllMocks())

  it("purges a deleted count's page", () => {
    const doc = { id: 3, slug: "leader" }
    expect(revalidateWhipCountDelete({ doc, req: req() } as never)).toBe(doc)
    expect(revalidateForReaders).toHaveBeenCalledWith(logger, "whip count leader deleted", {
      purgeOnly: ["/interactives/whip-counts/leader"],
    })
  })

  it("skips one with no slug, or when asked not to", () => {
    revalidateWhipCountDelete({ doc: { id: 3 }, req: req() } as never)
    revalidateWhipCountDelete({
      doc: { id: 3, slug: "leader" },
      req: req({ disableRevalidate: true }),
    } as never)
    expect(revalidateForReaders).not.toHaveBeenCalled()
  })
})
