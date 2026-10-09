import type { Payload } from "payload"
import type React from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { ContributorsBlock } from "@/blocks/Contributors/Component"
import type { Article, Media, Page, User } from "@/payload-types"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { testFile } from "../fixtures/media"
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
      file: testFile(),
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

describe("contributors block", () => {
  async function savePage(people: number[]) {
    // Only admins and chief editors may create pages.
    const chief = await createUser("chief-editor")
    return payload.create({
      collection: "pages",
      overrideAccess: false,
      user: chief,
      context: { disableRevalidate: true },
      data: {
        title: `Contributors ${Date.now()}`,
        hero: { type: "lowImpact" },
        layout: [{ blockType: "contributors", title: "Contributors", people }],
        _status: "published",
      } as unknown as Page,
    })
  }

  /** The users a Contributors block renders a card for. */
  async function rendered(people: number[]): Promise<number[]> {
    const tree = (await ContributorsBlock({
      blockType: "contributors",
      title: "Contributors",
      people,
    })) as React.ReactElement<{ children: React.ReactElement<{ children: unknown }>[] }> | null
    if (!tree) return []
    const list = tree.props.children[1]!.props.children as React.ReactElement<{ author: User }>[]
    return list.map((card) => card.props.author.id)
  }

  it("lets a chief editor list staff and public profiles", async () => {
    const [writer, demoted] = await Promise.all([createUser("writer"), createUser("writer")])
    await publishArticle([demoted.id])
    await demote(demoted)

    await expect(savePage([writer.id, demoted.id])).resolves.toMatchObject({
      id: expect.any(Number),
    })
  })

  it("rejects a member without a public profile", async () => {
    const member = await createUser("member")
    await expect(savePage([member.id])).rejects.toThrow(/People/)
  })

  it("leaves out anyone whose author page readers can't open", async () => {
    const [writer, credited, uncredited] = await Promise.all([
      createUser("writer"),
      createUser("writer"),
      createUser("writer"),
    ])
    await publishArticle([credited.id])
    await Promise.all([demote(credited), demote(uncredited)])

    expect(await rendered([uncredited.id, credited.id, writer.id])).toEqual([
      credited.id,
      writer.id,
    ])
  })
})
