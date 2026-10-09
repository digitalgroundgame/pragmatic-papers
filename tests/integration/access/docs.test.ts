import { beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"
import type { Doc, User } from "@/payload-types"
import { createUser, getPayload } from "../helpers/testUsers"

const content = {
  root: {
    type: "root",
    version: 1,
    children: [
      { type: "paragraph", version: 1, children: [{ type: "text", text: "Hi", version: 1 }] },
    ],
  },
}

describe("docs read access", () => {
  let payload: Payload
  const slugs = {
    everyone: `docs-access-everyone-${Date.now()}`,
    editors: `docs-access-editors-${Date.now()}`,
    draft: `docs-access-draft-${Date.now()}`,
  }

  const create = (slug: string, data: Partial<Doc>) =>
    payload.create({
      collection: "docs",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: slug,
        slug,
        summary: "A doc",
        publishedAt: "2026-10-18T00:00:00.000Z",
        content,
        _status: "published",
        ...data,
      } as Doc,
    })

  const readable = async (user?: User) =>
    (
      await payload.find({
        collection: "docs",
        overrideAccess: false,
        user,
        where: { slug: { in: Object.values(slugs) } },
      })
    ).docs
      .map((doc) => doc.slug)
      .sort()

  beforeAll(async () => {
    payload = await getPayload()
    await create(slugs.everyone, {})
    await create(slugs.editors, { audience: ["editor"] })
    await create(slugs.draft, { _status: "draft" })
  })

  it("lets a visitor read only published docs written for everyone", async () => {
    await expect(readable()).resolves.toEqual([slugs.everyone])
    await expect(readable(await createUser("member"))).resolves.toEqual([slugs.everyone])
  })

  it("lets staff read every doc, whatever its audience", async () => {
    await expect(readable(await createUser("writer"))).resolves.toEqual(Object.values(slugs).sort())
  })
})
