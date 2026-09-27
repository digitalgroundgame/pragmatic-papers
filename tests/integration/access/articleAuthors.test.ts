import config from "@payload-config"
import { handleEndpoints, type Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { Media, User } from "@/payload-types"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { MINIMAL_PNG } from "../fixtures/media"
import { createUser, getPayload, type Role } from "../helpers/testUsers"

// Publishing revalidates the article's pages, which needs a Next.js request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let payload: Payload

async function tokenFor(user: User): Promise<string> {
  const login = await payload.login({
    collection: "users",
    data: { email: user.email, password: "test-password" },
  })
  return login.token!
}

/**
 * Publishes an article through the REST API, the path the admin and `pnpm showcase`
 * take. Drafts skip field validation, so only a publish exercises the authors filter.
 */
async function createArticleOverREST(as: User, authors: number[]) {
  const response = await handleEndpoints({
    config,
    request: new Request("http://localhost/api/articles", {
      method: "POST",
      headers: { Authorization: `JWT ${await tokenFor(as)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Authors ${Date.now()}`,
        content: ARTICLE_CONTENT,
        authors,
        _status: "published",
      }),
    }),
  })
  const body = (await response.json()) as { errors?: { message: string }[] }
  return { status: response.status, errors: body.errors?.map((error) => error.message) }
}

beforeAll(async () => {
  payload = await getPayload()
})

describe("article authors (REST)", () => {
  it.each<Role>(["writer", "editor", "chief-editor"])(
    "lets a %s credit another staff member as author",
    async (role) => {
      const [user, colleague] = await Promise.all([createUser(role), createUser("narrator")])
      const { status, errors } = await createArticleOverREST(user, [user.id, colleague.id])
      expect(errors).toBeUndefined()
      expect(status).toBe(201)
    },
  )

  it.each<Role[]>([["member"], ["admin"]])(
    "still rejects a %s, who can't be credited as author",
    async (roles) => {
      const [editor, outsider] = await Promise.all([createUser("editor"), createUser(roles)])
      const { status, errors } = await createArticleOverREST(editor, [outsider.id])
      expect(status).toBe(400)
      expect(errors?.join()).toMatch(/Authors/)
    },
  )
})

describe("media narrator", () => {
  async function setNarrator(as: User, narrator: User) {
    const media = await payload.create({
      collection: "media",
      context: { disableRevalidate: true },
      file: {
        data: MINIMAL_PNG,
        mimetype: "image/png",
        name: "test.png",
        size: MINIMAL_PNG.length,
      },
      data: { alt: "Narrated" } as unknown as Media,
    })
    return payload.update({
      collection: "media",
      id: media.id,
      data: { narrator: narrator.id },
      overrideAccess: false,
      user: as,
      context: { disableRevalidate: true },
    })
  }

  it("lets an editor credit a narrator", async () => {
    const [editor, narrator] = await Promise.all([createUser("editor"), createUser("narrator")])
    const updated = await setNarrator(editor, narrator)
    expect(updated.narrator).toMatchObject({ id: narrator.id })
  })

  it("rejects crediting a non-narrator", async () => {
    const [editor, writer] = await Promise.all([createUser("editor"), createUser("writer")])
    await expect(setNarrator(editor, writer)).rejects.toThrow(/Narrator/)
  })
})
