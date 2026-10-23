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
