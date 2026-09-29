import type { CollectionBeforeDeleteHook } from "payload"
import { APIError } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MediaReference } from "../../references/collectMediaReferences"
import { mediaReferencesInRequest } from "../../references/collectMediaReferences"
import { DELETE_MEDIA_IN_USE, protectPublishedMedia } from "../protectPublishedMedia"

vi.mock("../../references/collectMediaReferences", () => ({
  mediaReferencesInRequest: vi.fn(),
}))

const logger = { warn: vi.fn() }
const payload = { logger }

const req = { payload }

const runHook = (context: Record<string, unknown> = {}) =>
  protectPublishedMedia({
    context,
    id: 42,
    req,
  } as unknown as Parameters<CollectionBeforeDeleteHook>[0])

const reference = (docTitle: string, docId = 1, field = "heroImage"): MediaReference => ({
  collection: "articles",
  field,
  docId,
  docTitle,
})

beforeEach(() => {
  vi.mocked(mediaReferencesInRequest).mockReset()
  logger.warn.mockReset()
})

describe("protectPublishedMedia", () => {
  it("lets unused media be deleted", async () => {
    vi.mocked(mediaReferencesInRequest).mockResolvedValue([])

    await expect(runHook()).resolves.toBeUndefined()
    expect(mediaReferencesInRequest).toHaveBeenCalledWith(req, 42)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("refuses with a message naming the document that uses the media", async () => {
    vi.mocked(mediaReferencesInRequest).mockResolvedValue([reference("Hero Article")])

    const error = await runHook().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(APIError)
    expect(error).toMatchObject({
      message:
        "Can't delete: it's used in \"Hero Article\" (article hero image). Replace or remove it there first.",
      status: 400,
    })
  })

  it("names several documents that use the media", async () => {
    vi.mocked(mediaReferencesInRequest).mockResolvedValue([
      reference("First", 1),
      reference("Second", 2, "meta.image"),
    ])

    await expect(runHook()).rejects.toThrow(
      'it\'s used in 2 published documents: "First" (article hero image) and "Second" (article SEO image)',
    )
  })

  it("logs the blocked delete with its references", async () => {
    const refs = [reference("Hero Article")]
    vi.mocked(mediaReferencesInRequest).mockResolvedValue(refs)

    await runHook().catch(() => undefined)

    expect(logger.warn).toHaveBeenCalledWith(
      { refs, mediaId: 42 },
      expect.stringContaining("Media deletion blocked"),
    )
  })

  it("stands aside when the delete says to clear media in use", async () => {
    vi.mocked(mediaReferencesInRequest).mockResolvedValue([reference("Hero Article")])

    await expect(runHook({ [DELETE_MEDIA_IN_USE]: true })).resolves.toBeUndefined()
    expect(mediaReferencesInRequest).not.toHaveBeenCalled()
  })
})
