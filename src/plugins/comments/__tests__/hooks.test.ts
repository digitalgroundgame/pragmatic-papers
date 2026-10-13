import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { COMMENTS_SLUG, VIOLATIONS_SLUG } from "../constants"
import { deleteAuthorsComments, deleteCommentsOnTarget } from "../hooks/deleteCommentsOn"
import { deleteReplies } from "../hooks/deleteReplies"
import { recordModeration, SKIP_MODERATION } from "../hooks/recordModeration"

const payload = { create: vi.fn(), update: vi.fn(), delete: vi.fn() }
const request = (context: Record<string, unknown> = {}) =>
  ({ payload, context }) as unknown as PayloadRequest

beforeEach(() => vi.clearAllMocks())

describe("recordModeration", () => {
  const change = (
    from: string,
    to: string,
    { operation = "update", context = {}, author = { id: 7 } as unknown } = {},
  ) =>
    recordModeration({
      doc: { id: 3, status: to, author },
      previousDoc: { status: from },
      operation,
      req: request(context),
    } as never)

  it("counts a moderator hiding a published comment against its author", async () => {
    await change("published", "hidden")
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: VIOLATIONS_SLUG,
        data: { author: 7, comment: 3, source: "moderator", reason: "Hidden by a moderator" },
      }),
    )
  })

  it("takes the author as an id or a populated document", async () => {
    await change("published", "hidden", { author: 8 })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ author: 8 }) }),
    )
  })

  it("reverses whatever counted when a held or hidden comment is published", async () => {
    await change("auto-hidden", "published")
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: VIOLATIONS_SLUG,
        where: { comment: { equals: 3 }, reversed: { not_equals: true } },
        data: { reversed: true },
      }),
    )
  })

  it("ignores creates, the plugin's own writes, unchanged statuses and authorless comments", async () => {
    await change("published", "hidden", { operation: "create" })
    await change("published", "hidden", { context: { [SKIP_MODERATION]: true } })
    await change("hidden", "hidden")
    await change("published", "hidden", { author: null })
    await change("published", "deleted")
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe("deleting", () => {
  it("a document takes its comments with it", async () => {
    await deleteCommentsOnTarget({ id: 5, req: request() } as never)
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: COMMENTS_SLUG, where: { target: { equals: 5 } } }),
    )
  })

  it("a comment takes its replies with it", async () => {
    await deleteReplies({ id: 3, req: request() } as never)
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: COMMENTS_SLUG, where: { parent: { equals: 3 } } }),
    )
  })

  it("an author empties their comments, keeping their place, and drops their violations", async () => {
    await deleteAuthorsComments({ id: 7, req: request() } as never)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: COMMENTS_SLUG,
        where: { author: { equals: 7 } },
        data: { body: "", status: "deleted", author: null },
        context: { [SKIP_MODERATION]: true },
      }),
    )
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: VIOLATIONS_SLUG, where: { author: { equals: 7 } } }),
    )
  })
})
