import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Article } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"
import { ARTICLE_CONTENT } from "../fixtures/content"

/**
 * A user may hold multiple roles at once (e.g. writer + narrator). Access
 * checks resolve the union of every role's permissions — see #883. Narrator
 * alone cannot create or update articles; adding the writer role grants those
 * capabilities without losing the narrator's staff-level read access.
 */
describe("combined writer + narrator role access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("allows a writer+narrator to create an article (writer path narrator lacks)", async () => {
    const user = await createUser(["writer", "narrator"])

    const article = await payload.create({
      collection: "articles",
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
      data: {
        title: "Article by Writer+Narrator",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    expect(article).toBeDefined()
    expect(article.title).toBe("Article by Writer+Narrator")
  })

  it("allows a writer+narrator to update their own draft article", async () => {
    const user = await createUser(["writer", "narrator"])

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft by Writer+Narrator",
        content: ARTICLE_CONTENT,
        _status: "draft",
        createdBy: user.id,
      } as unknown as Article,
      user,
    })

    const updated = await payload.update({
      collection: "articles",
      id: draft.id,
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
      data: { title: "Updated by Writer+Narrator" },
    })

    expect(updated.title).toBe("Updated by Writer+Narrator")
  })

  it("still denies a writer+narrator from publishing (writer role is not editor)", async () => {
    const user = await createUser(["writer", "narrator"])

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft to Publish by Writer+Narrator",
        content: ARTICLE_CONTENT,
        _status: "draft",
        createdBy: user.id,
      } as unknown as Article,
      user,
    })

    await expect(
      payload.update({
        collection: "articles",
        id: draft.id,
        overrideAccess: false,
        user,
        context: { disableRevalidate: true },
        data: { _status: "published" },
      }),
    ).rejects.toThrow()
  })

  it("grants a writer+narrator staff-level read access to draft articles", async () => {
    const user = await createUser(["writer", "narrator"])

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Someone Else's Draft - wn",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    const result = await payload.find({
      collection: "articles",
      overrideAccess: false,
      user,
      draft: true,
      where: { id: { equals: draft.id } },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0]?.id).toBe(draft.id)
  })
})
