import { Forbidden, type Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { Article, User } from "@/payload-types"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { createUser, getPayload } from "../helpers/testUsers"

// Publishing revalidates the article's pages, which needs a Next.js request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let payload: Payload

beforeAll(async () => {
  payload = await getPayload()
})

/** What `POST /api/articles` does with this body, as this user. */
function create(user: User, data: Partial<Article>, draft?: boolean) {
  return payload.create({
    collection: "articles",
    overrideAccess: false,
    user,
    draft,
    context: { disableRevalidate: true },
    data: {
      title: `Created ${Date.now()} ${Math.random()}`,
      content: ARTICLE_CONTENT,
      ...data,
    } as unknown as Article,
  })
}

async function countByTitle(title: string): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: "articles",
    where: { title: { equals: title } },
  })
  return totalDocs
}

describe("creating an article", () => {
  it("refuses a writer one that is already published", async () => {
    const writer = await createUser("writer")
    const title = `Published on create ${Date.now()}`

    await expect(create(writer, { title, _status: "published" })).rejects.toBeInstanceOf(Forbidden)
    expect(await countByTitle(title)).toBe(0)
  })

  it("lets a writer create a draft", async () => {
    const writer = await createUser("writer")

    const draft = await create(writer, { _status: "draft" }, true)
    expect(draft._status).toBe("draft")
  })

  it("saves a writer's article as a draft when it names no status", async () => {
    const writer = await createUser("writer")

    const article = await create(writer, {})
    expect(article._status).toBe("draft")
  })

  it("lets an editor create a published article", async () => {
    const editor = await createUser("editor")

    const article = await create(editor, { _status: "published" })
    expect(article._status).toBe("published")
  })
})
