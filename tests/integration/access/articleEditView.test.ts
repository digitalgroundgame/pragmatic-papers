import { createLocalReq, docAccessOperation, type Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"
import type { Article, User } from "@/payload-types"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { createUser, getPayload } from "../helpers/testUsers"

// The admin's edit view shows Save, Publish and the autosave status only when the
// document's `update` permission holds for a draft, worked out as
// `getDocumentPermissions` (@payloadcms/next) does: `docAccessOperation` with the
// document's data and `_status: "draft"`, its `where` run against the document.
let payload: Payload
const ctx = { disableRevalidate: true }

beforeAll(async () => {
  payload = await getPayload()
})

async function canSave(user: User, article: Article): Promise<boolean> {
  const req = await createLocalReq({ user: { ...user, collection: "users" } }, payload)
  const permissions = await docAccessOperation({
    id: article.id,
    collection: payload.collections.articles,
    data: { ...article, _status: "draft" },
    req,
  })
  return Boolean(permissions.update)
}

async function draftBy(user: User, data: Partial<Article> = {}): Promise<Article> {
  return payload.create({
    collection: "articles",
    overrideAccess: false,
    user,
    draft: true,
    context: ctx,
    data: {
      title: `Edit view ${Date.now()}`,
      content: ARTICLE_CONTENT,
      ...data,
      _status: "draft",
    } as unknown as Article,
  })
}

describe("article edit view save permission", () => {
  it("lets a writer save the draft they started", async () => {
    const writer = await createUser("writer")
    expect(await canSave(writer, await draftBy(writer))).toBe(true)
  })

  it("lets a writer save a draft an editor started and credited them on", async () => {
    const [editor, writer] = await Promise.all([createUser("editor"), createUser("writer")])
    const article = await draftBy(editor, { authors: [writer.id] })
    expect(await canSave(writer, article)).toBe(true)
  })

  it("lets a writer save once a later draft save credits them", async () => {
    const [editor, writer] = await Promise.all([createUser("editor"), createUser("writer")])
    const article = await draftBy(editor)
    expect(await canSave(writer, article)).toBe(false)

    const credited = await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: false,
      user: editor,
      draft: true,
      autosave: true,
      context: ctx,
      data: { authors: [writer.id], _status: "draft" },
    })
    expect(await canSave(writer, credited)).toBe(true)
  })

  it("still keeps a writer out of a draft they aren't credited on", async () => {
    const [editor, writer, coAuthor] = await Promise.all([
      createUser("editor"),
      createUser("writer"),
      createUser("writer"),
    ])
    const article = await draftBy(editor, { authors: [coAuthor.id] })
    expect(await canSave(writer, article)).toBe(false)
  })
})
