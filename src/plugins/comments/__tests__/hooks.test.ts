import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { COMMENTS_SLUG, FIRST_COMMENTED_FIELD, VIOLATIONS_SLUG } from "../constants"
import { deleteAuthorsComments, deleteCommentsOnTarget } from "../hooks/deleteCommentsOn"
import { deleteReplies } from "../hooks/deleteReplies"
import {
  refreshFirstCommented,
  SKIP_FIRST_COMMENTED,
  syncFirstCommentedOnChange,
  syncFirstCommentedOnDelete,
} from "../hooks/firstCommented"
import { recordModeration, SKIP_MODERATION } from "../hooks/recordModeration"
import type { ResolvedCommentsConfig } from "../types"

const payload = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  findDistinct: vi.fn(),
}
const config = { authorsSlug: "users" } as ResolvedCommentsConfig
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
  it("a document takes its comments with it, then updates each commenter once", async () => {
    payload.findDistinct.mockResolvedValue({ values: [{ author: 7 }, { author: 8 }, {}] })
    payload.findByID.mockResolvedValue({ id: 7, [FIRST_COMMENTED_FIELD]: null })
    payload.find.mockResolvedValue({ docs: [] })

    await deleteCommentsOnTarget(config)({ id: 5, req: request() } as never)

    expect(payload.findDistinct).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "author",
        where: { target: { equals: 5 }, status: { equals: "published" } },
      }),
    )
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: COMMENTS_SLUG,
        where: { target: { equals: 5 } },
        context: { [SKIP_FIRST_COMMENTED]: true },
      }),
    )
    expect(payload.findByID.mock.calls.map(([args]) => args.id)).toEqual([7, 8])
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

describe("first-commented time", () => {
  const stored = (value: string | null) =>
    payload.findByID.mockResolvedValue({ id: 7, [FIRST_COMMENTED_FIELD]: value })
  const earliest = (createdAt?: string) =>
    payload.find.mockResolvedValue({ docs: createdAt ? [{ createdAt }] : [] })

  it("is set to the author's earliest published comment", async () => {
    stored(null)
    earliest("2026-10-01T00:00:00.000Z")

    await refreshFirstCommented(config, 7, request())

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: COMMENTS_SLUG,
        where: { author: { equals: 7 }, status: { equals: "published" } },
        sort: "createdAt",
        limit: 1,
      }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        id: 7,
        data: { [FIRST_COMMENTED_FIELD]: "2026-10-01T00:00:00.000Z" },
      }),
    )
  })

  it("empties when nothing of theirs is published, and isn't written when it's unchanged", async () => {
    stored("2026-10-01T00:00:00.000Z")
    earliest()
    await refreshFirstCommented(config, 7, request())
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { [FIRST_COMMENTED_FIELD]: null } }),
    )

    payload.update.mockClear()
    // The same moment, written another way by the database.
    stored("2026-10-01T00:00:00+00:00")
    earliest("2026-10-01T00:00:00.000Z")
    await refreshFirstCommented(config, 7, request())
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("skips an author who is gone", async () => {
    payload.findByID.mockResolvedValue(null)
    earliest("2026-10-01T00:00:00.000Z")
    await refreshFirstCommented(config, 7, request())
    expect(payload.update).not.toHaveBeenCalled()
  })

  const change = (
    from: string | undefined,
    to: string,
    { operation = "update", author = { id: 7 } as unknown } = {},
  ) =>
    syncFirstCommentedOnChange(config)({
      doc: { id: 3, status: to, author },
      previousDoc: from === undefined ? undefined : { status: from },
      operation,
      req: request(),
    } as never)

  it("is brought up to date when a comment is published, or stops being", async () => {
    stored(null)
    earliest()
    await change(undefined, "published", { operation: "create" })
    await change("published", "hidden")
    await change("auto-hidden", "published")
    expect(payload.findByID).toHaveBeenCalledTimes(3)
  })

  it("is left alone when no published comment comes or goes", async () => {
    await change(undefined, "auto-hidden", { operation: "create" })
    await change("published", "published")
    await change("hidden", "auto-hidden")
    // An account being deleted empties its comments' author.
    await change("published", "deleted", { author: null })
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it("is brought up to date when a published comment is deleted, unless a bulk delete does it", async () => {
    stored(null)
    earliest()
    const remove = (status: string, context: Record<string, unknown> = {}) =>
      syncFirstCommentedOnDelete(config)({
        doc: { id: 3, status, author: 7 },
        req: request(context),
      } as never)

    await remove("hidden")
    await remove("published", { [SKIP_FIRST_COMMENTED]: true })
    expect(payload.findByID).not.toHaveBeenCalled()

    await remove("published")
    expect(payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
  })
})
