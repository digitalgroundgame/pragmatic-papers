import type { Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { Article, User } from "@/payload-types"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { createUser, getPayload } from "../helpers/testUsers"

// Publishing revalidates the article's pages, which needs a Next.js request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let payload: Payload
const ctx = { disableRevalidate: true }

beforeAll(async () => {
  payload = await getPayload()
})

async function liveArticle(data: Partial<Article>): Promise<Article> {
  return payload.create({
    collection: "articles",
    overrideAccess: true,
    context: ctx,
    data: {
      title: `Live ${Date.now()}`,
      content: ARTICLE_CONTENT,
      ...data,
      _status: "published",
    } as unknown as Article,
  })
}

/** What the admin's Unpublish button sends: a draft status, without saving a draft. */
function unpublish(user: User, id: number) {
  return payload.update({
    collection: "articles",
    id,
    overrideAccess: false,
    user,
    context: ctx,
    data: { _status: "draft" },
  })
}

async function isLive(id: number): Promise<boolean> {
  const article = await payload.findByID({ collection: "articles", id, depth: 0 })
  return article._status === "published"
}

describe("unpublishing an article", () => {
  it("is refused to a writer credited on it", async () => {
    const writer = await createUser("writer")
    const article = await liveArticle({ authors: [writer.id] })

    await expect(unpublish(writer, article.id)).rejects.toThrow()
    expect(await isLive(article.id)).toBe(true)
  })

  it("is refused to the writer who created it", async () => {
    const writer = await createUser("writer")
    const article = await liveArticle({ createdBy: writer.id })

    await expect(unpublish(writer, article.id)).rejects.toThrow()
    expect(await isLive(article.id)).toBe(true)
  })

  it("still lets a credited writer save a draft of it, leaving it live", async () => {
    const writer = await createUser("writer")
    const article = await liveArticle({ authors: [writer.id] })

    const draft = await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: false,
      user: writer,
      draft: true,
      autosave: true,
      context: ctx,
      data: { title: "Draft of a live article", _status: "draft" },
    })

    expect(draft.title).toBe("Draft of a live article")
    expect(await isLive(article.id)).toBe(true)
  })

  it("is allowed to an editor", async () => {
    const editor = await createUser("editor")
    const article = await liveArticle({})

    await unpublish(editor, article.id)
    expect(await isLive(article.id)).toBe(false)
  })

  it("leaves a writer's own unpublished draft saveable without the draft flag", async () => {
    const writer = await createUser("writer")
    const draft = await payload.create({
      collection: "articles",
      overrideAccess: false,
      user: writer,
      draft: true,
      context: ctx,
      data: {
        title: `Never live ${Date.now()}`,
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    const saved = await unpublish(writer, draft.id)
    expect(saved._status).toBe("draft")
  })
})

describe("restoring a draft version of a live article", () => {
  /** A live article whose history holds an earlier draft version, and that version's id. */
  async function liveWithDraftVersion(data: Partial<Article>) {
    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      draft: true,
      context: ctx,
      data: {
        title: `Restorable ${Date.now()}`,
        content: ARTICLE_CONTENT,
        ...data,
        _status: "draft",
      } as unknown as Article,
    })
    await payload.update({
      collection: "articles",
      id: draft.id,
      overrideAccess: true,
      context: ctx,
      data: { _status: "published" },
    })
    const { docs } = await payload.findVersions({
      collection: "articles",
      where: { parent: { equals: draft.id }, "version._status": { equals: "draft" } },
      depth: 0,
    })
    return { id: draft.id, versionId: String(docs[0]!.id) }
  }

  function restore(user: User, versionId: string, draft?: boolean) {
    return payload.restoreVersion({
      collection: "articles",
      id: versionId,
      overrideAccess: false,
      user,
      draft,
      // Payload marks the context it's given as restoring, so give it its own.
      context: { ...ctx },
    })
  }

  it("is refused to a writer credited on it", async () => {
    const writer = await createUser("writer")
    const { id, versionId } = await liveWithDraftVersion({ authors: [writer.id] })

    await expect(restore(writer, versionId)).rejects.toThrow()
    expect(await isLive(id)).toBe(true)
  })

  it("is allowed to an editor", async () => {
    const editor = await createUser("editor")
    const { id, versionId } = await liveWithDraftVersion({})

    await restore(editor, versionId)
    expect(await isLive(id)).toBe(false)
  })
})

describe("deleting an article", () => {
  function remove(user: User, id: number) {
    return payload.delete({ collection: "articles", id, overrideAccess: false, user, context: ctx })
  }

  it("is refused to the writer who created it while it's live", async () => {
    const writer = await createUser("writer")
    const article = await liveArticle({ createdBy: writer.id })

    await expect(remove(writer, article.id)).rejects.toThrow()
    expect(await isLive(article.id)).toBe(true)
  })

  it("is allowed to the writer who created it once it isn't live", async () => {
    const writer = await createUser("writer")
    const editor = await createUser("editor")
    const article = await liveArticle({ createdBy: writer.id })
    await unpublish(editor, article.id)

    const deleted = await remove(writer, article.id)
    expect(deleted.id).toBe(article.id)
  })

  it("is allowed to an editor while it's live", async () => {
    const editor = await createUser("editor")
    const article = await liveArticle({})

    const deleted = await remove(editor, article.id)
    expect(deleted.id).toBe(article.id)
  })
})
