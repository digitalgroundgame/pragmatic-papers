// @vitest-environment node
import { Forbidden } from "payload"
import { describe, expect, it, vi } from "vitest"

import { keepWritersOffLiveArticles } from "../keepWritersOffLiveArticles"

const writer = { id: 7, roles: ["writer"] }
const editor = { id: 8, roles: ["editor"] }

/** A Payload stand-in holding one article's live status (`null` when missing) and, optionally, one version. */
function fakeReq({
  user = writer as { id: number; roles: string[] } | null,
  status = "published" as string | null,
  version = undefined as { parent: unknown; status?: string } | undefined,
} = {}) {
  const findByID = vi.fn(async () => (status === null ? null : { _status: status }))
  const findVersionByID = vi.fn(async () =>
    version ? { parent: version.parent, version: { _status: version.status } } : null,
  )
  return { req: { user, t: vi.fn(), payload: { findByID, findVersionByID } }, findByID }
}

const run = (operation: string, args: Record<string, unknown>, req: unknown) =>
  keepWritersOffLiveArticles({ args, operation, req } as never)

const unpublishArgs = { id: 1, data: { _status: "draft" } }

describe("keepWritersOffLiveArticles on update", () => {
  it("refuses a writer unpublishing a live article", async () => {
    const { req } = fakeReq()
    await expect(run("update", unpublishArgs, req)).rejects.toBeInstanceOf(Forbidden)
  })

  it("lets a writer save a draft of a live article", async () => {
    const { req, findByID } = fakeReq()
    const args = { ...unpublishArgs, draft: true }
    await expect(run("update", args, req)).resolves.toBe(args)
    expect(findByID).not.toHaveBeenCalled()
  })

  it("lets a writer save an article that isn't live", async () => {
    const { req } = fakeReq({ status: "draft" })
    await expect(run("update", unpublishArgs, req)).resolves.toBe(unpublishArgs)
  })

  it("lets a writer through when the article is missing, for the update to fail on its own", async () => {
    const { req } = fakeReq({ status: null })
    await expect(run("update", unpublishArgs, req)).resolves.toBe(unpublishArgs)
  })

  it("refuses a writer changing a live article in place, without a draft or a status", async () => {
    const { req } = fakeReq()
    await expect(run("update", { id: 1, data: { title: "Renamed" } }, req)).rejects.toBeInstanceOf(
      Forbidden,
    )
  })

  it("lets a writer change an article that isn't live in place", async () => {
    const { req } = fakeReq({ status: "draft" })
    const args = { id: 1, data: { title: "Renamed" } }
    await expect(run("update", args, req)).resolves.toBe(args)
  })

  it("refuses a writer's bulk update to a draft status", async () => {
    const { req } = fakeReq()
    await expect(run("update", { data: { _status: "draft" } }, req)).rejects.toBeInstanceOf(
      Forbidden,
    )
  })

  it("lets editors, overrideAccess and anonymous requests through untouched", async () => {
    for (const { req } of [fakeReq({ user: editor }), fakeReq({ user: null })]) {
      await expect(run("update", unpublishArgs, req)).resolves.toBe(unpublishArgs)
    }
    const { req, findByID } = fakeReq()
    const args = { ...unpublishArgs, overrideAccess: true }
    await expect(run("update", args, req)).resolves.toBe(args)
    expect(findByID).not.toHaveBeenCalled()
  })

  it("ignores other operations", async () => {
    const { req, findByID } = fakeReq()
    await expect(run("create", unpublishArgs, req)).resolves.toBe(unpublishArgs)
    expect(findByID).not.toHaveBeenCalled()
  })
})

describe("keepWritersOffLiveArticles on restoreVersion", () => {
  it("refuses a writer restoring a draft version over a live article", async () => {
    const { req } = fakeReq({ version: { parent: 1, status: "draft" } })
    await expect(run("restoreVersion", { id: "v1" }, req)).rejects.toBeInstanceOf(Forbidden)
  })

  it("reads the parent's id from a populated relationship", async () => {
    const { req, findByID } = fakeReq({ version: { parent: { id: 1 }, status: "draft" } })
    await expect(run("restoreVersion", { id: "v1" }, req)).rejects.toBeInstanceOf(Forbidden)
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it("leaves restoring a published version to access, which refuses writers a publish", async () => {
    const { req, findByID } = fakeReq({ version: { parent: 1, status: "published" } })
    const args = { id: "v1" }
    await expect(run("restoreVersion", args, req)).resolves.toBe(args)
    expect(findByID).not.toHaveBeenCalled()
  })

  it("lets a writer restore as a draft", async () => {
    const { req } = fakeReq({ version: { parent: 1, status: "draft" } })
    const args = { id: "v1", draft: true }
    await expect(run("restoreVersion", args, req)).resolves.toBe(args)
  })

  it("lets a writer restore a draft version of an article that isn't live", async () => {
    const { req } = fakeReq({ status: "draft", version: { parent: 1, status: "draft" } })
    const args = { id: "v1" }
    await expect(run("restoreVersion", args, req)).resolves.toBe(args)
  })

  it("lets a writer through when the version or its parent is missing", async () => {
    for (const { req } of [fakeReq(), fakeReq({ version: { parent: null, status: "draft" } })]) {
      const args = { id: "v1" }
      await expect(run("restoreVersion", args, req)).resolves.toBe(args)
    }
  })
})
