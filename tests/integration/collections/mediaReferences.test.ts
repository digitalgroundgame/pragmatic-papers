import { beforeAll, describe, expect, it } from "vitest"
import type { Payload, PayloadRequest } from "payload"
import type { Article, Media, User } from "@/payload-types"
import { referencesHandler } from "@/collections/Media/endpoints/references"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { testFile } from "../fixtures/media"
import { createUser, getPayload } from "../helpers/testUsers"

describe("media references", () => {
  let payload: Payload
  let editor: User

  beforeAll(async () => {
    payload = await getPayload()
    editor = await createUser("editor")
  })

  const createMedia = (alt: string): Promise<Media> =>
    payload.create({
      collection: "media",
      overrideAccess: true,
      context: { disableRevalidate: true },
      file: testFile(),
      data: { alt } as unknown as Media,
      user: editor,
    })

  const createArticle = (title: string, heroImage: number, status: "draft" | "published") =>
    payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      draft: status === "draft",
      data: { title, content: ARTICLE_CONTENT, heroImage, _status: status } as unknown as Article,
    })

  const deleteAsEditor = (id: number) =>
    payload.delete({
      collection: "media",
      id,
      overrideAccess: false,
      user: editor,
      context: { disableRevalidate: true },
    })

  const callReferences = (user: User | null, id: number | string) =>
    referencesHandler({
      user,
      payload,
      routeParams: { id: String(id) },
    } as unknown as PayloadRequest)

  describe("delete", () => {
    it("blocks deleting media used by a published article", async () => {
      const media = await createMedia("Referenced - mref")
      await createArticle("Uses Media - mref", media.id, "published")

      await expect(deleteAsEditor(media.id)).rejects.toThrow(/Cannot delete: used in/)

      const stillThere = await payload.findByID({ collection: "media", id: media.id })
      expect(stillThere.id).toBe(media.id)
    })

    it("blocks a bulk delete of referenced media", async () => {
      const media = await createMedia("Bulk Referenced - mref")
      await createArticle("Bulk Uses Media - mref", media.id, "published")

      const result = await payload.delete({
        collection: "media",
        where: { id: { equals: media.id } },
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
      })

      expect(result.docs).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
    })

    it("allows deleting media only a draft uses", async () => {
      const media = await createMedia("Draft Only - mref")
      await createArticle("Draft Uses Media - mref", media.id, "draft")

      await expect(deleteAsEditor(media.id)).resolves.toMatchObject({ id: media.id })
    })

    it("allows deleting unused media", async () => {
      const media = await createMedia("Unused - mref")

      await expect(deleteAsEditor(media.id)).resolves.toMatchObject({ id: media.id })
    })
  })

  describe("references endpoint", () => {
    it("lists the published documents that use the media", async () => {
      const media = await createMedia("Listed - mref")
      const article = await createArticle("Listed Article - mref", media.id, "published")

      const response = await callReferences(editor, media.id)

      expect(response.status).toBe(200)
      // Saving an article copies its hero image into an empty SEO image
      // (populateMetaImageFromHero), so it is listed under both fields.
      const { references } = (await response.json()) as { references: unknown[] }
      expect(references).toEqual([
        expect.objectContaining({ docId: article.id, field: "heroImage" }),
        expect.objectContaining({ docId: article.id, field: "meta.image" }),
      ])
      expect(references[0]).toMatchObject({
        collection: "articles",
        docTitle: "Listed Article - mref",
      })
    })

    it("rejects an anonymous request", async () => {
      const response = await callReferences(null, 1)
      expect(response.status).toBe(401)
    })

    it("rejects a member, who isn't staff", async () => {
      const member = await createUser("member")
      const response = await callReferences(member, 1)
      expect(response.status).toBe(403)
    })

    it("rejects a non-numeric id", async () => {
      const response = await callReferences(editor, "abc")
      expect(response.status).toBe(400)
    })
  })
})
