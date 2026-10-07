import type { Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { Article, Media, User } from "@/payload-types"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { MINIMAL_PNG } from "../fixtures/media"
import { createUser, getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let payload: Payload

beforeAll(async () => {
  payload = await getPayload()
})

async function publishArticle(authors: number[]): Promise<Article> {
  return payload.create({
    collection: "articles",
    context: { disableRevalidate: true },
    data: {
      title: `Public profile ${Date.now()}`,
      content: ARTICLE_CONTENT,
      authors,
      _status: "published",
    } as unknown as Article,
  })
}

async function demote(user: User): Promise<void> {
  await payload.update({
    collection: "users",
    id: user.id,
    data: { roles: ["member"] },
    context: { disableRevalidate: true },
  })
}

/** What an anonymous reader gets for `/authors/<slug>`. */
async function anonymousProfile(user: User) {
  const { docs } = await payload.find({
    collection: "users",
    where: { slug: { equals: user.slug } },
    overrideAccess: false,
  })
  return docs[0] ?? null
}

describe("publicProfile", () => {
  it("is set on the users an article credits", async () => {
    const writer = await createUser("writer")
    expect(writer.publicProfile).toBeFalsy()

    await publishArticle([writer.id])

    const after = await payload.findByID({ collection: "users", id: writer.id })
    expect(after.publicProfile).toBe(true)
  })

  it("keeps a demoted author's page and byline readable", async () => {
    const writer = await createUser("writer")
    const article = await publishArticle([writer.id])
    await demote(writer)

    expect(await anonymousProfile(writer)).toMatchObject({ id: writer.id })

    const byline = await payload.findByID({
      collection: "articles",
      id: article.id,
      depth: 1,
      overrideAccess: false,
    })
    expect(byline.authors).toEqual([expect.objectContaining({ id: writer.id })])
  })

  it("lists a demoted author on the authors index", async () => {
    const writer = await createUser("writer")
    await publishArticle([writer.id])
    await demote(writer)

    const { docs } = await payload.find({
      collection: "users",
      where: {
        id: { equals: writer.id },
        or: [{ roles: { in: ["writer"] } }, { publicProfile: { equals: true } }],
      },
    })
    expect(docs).toHaveLength(1)
  })

  it("still hides a member nobody has credited", async () => {
    const member = await createUser("member")
    expect(await anonymousProfile(member)).toBeNull()
  })

  it("is set on a narration's narrator", async () => {
    const narrator = await createUser("narrator")
    await payload.create({
      collection: "media",
      context: { disableRevalidate: true },
      file: {
        data: MINIMAL_PNG,
        mimetype: "image/png",
        name: "test.png",
        size: MINIMAL_PNG.length,
      },
      data: { alt: "Narrated", narrator: narrator.id } as unknown as Media,
    })

    const after = await payload.findByID({ collection: "users", id: narrator.id })
    expect(after.publicProfile).toBe(true)
  })

  it("can't be turned on by the user themselves", async () => {
    const member = await createUser("member")
    const updated = await payload.update({
      collection: "users",
      id: member.id,
      data: { publicProfile: true },
      overrideAccess: false,
      user: member,
      context: { disableRevalidate: true },
    })
    expect(updated.publicProfile).toBeFalsy()
  })
})
