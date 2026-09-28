import type { CollectionBeforeDeleteHook } from "payload"
import { APIError } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MediaReference } from "../../references/collectMediaReferences"
import { collectMediaReferences } from "../../references/collectMediaReferences"
import { protectPublishedMedia } from "../protectPublishedMedia"

vi.mock("../../references/collectMediaReferences", () => ({
  collectMediaReferences: vi.fn(),
}))

const logger = { warn: vi.fn() }
const payload = { logger }

const runHook = () =>
  protectPublishedMedia({
    id: 42,
    req: { payload },
  } as unknown as Parameters<CollectionBeforeDeleteHook>[0])

const reference = (docTitle: string, field = "heroImage"): MediaReference => ({
  collection: "articles",
  field,
  docId: 1,
  docTitle,
})

beforeEach(() => {
  vi.mocked(collectMediaReferences).mockReset()
  logger.warn.mockReset()
})

describe("protectPublishedMedia", () => {
  it("lets unused media be deleted", async () => {
    vi.mocked(collectMediaReferences).mockResolvedValue([])

    await expect(runHook()).resolves.toBeUndefined()
    expect(collectMediaReferences).toHaveBeenCalledWith(payload, 42)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("names the one document that uses the media", async () => {
    vi.mocked(collectMediaReferences).mockResolvedValue([reference("Hero Article")])

    const error = await runHook().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(APIError)
    expect(error).toMatchObject({
      message: 'Cannot delete: used in "Hero Article" (articles/heroImage)',
      status: 400,
    })
  })

  it("counts the documents when several use the media", async () => {
    vi.mocked(collectMediaReferences).mockResolvedValue([
      reference("First"),
      reference("Second", "meta.image"),
      reference("Third"),
    ])

    await expect(runHook()).rejects.toThrow("Cannot delete: used in 3 published documents")
  })

  it("logs the blocked delete with its references", async () => {
    const refs = [reference("Hero Article")]
    vi.mocked(collectMediaReferences).mockResolvedValue(refs)

    await runHook().catch(() => undefined)

    expect(logger.warn).toHaveBeenCalledWith(
      { refs, mediaId: 42 },
      expect.stringContaining("Media deletion blocked"),
    )
  })
})
