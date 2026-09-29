import { beforeAll, describe, expect, it } from "vitest"
import type { Payload, PayloadRequest } from "payload"
import type { Article, Media, User } from "@/payload-types"
import { detachHandler } from "@/collections/Media/endpoints/detach"
import { referencesHandler } from "@/collections/Media/endpoints/references"
import { DELETE_MEDIA_IN_USE } from "@/collections/Media/hooks/protectPublishedMedia"
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

      await expect(deleteAsEditor(media.id)).rejects.toThrow(
        /Can't delete: it's used in "Uses Media - mref" \(article hero image, SEO image\)/,
      )

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

    it("blocks each referenced media in one bulk delete, keeping the unused one", async () => {
      const used = await createMedia("Bulk Used A - mref")
      const alsoUsed = await createMedia("Bulk Used B - mref")
      const unused = await createMedia("Bulk Unused - mref")
      await createArticle("Bulk Uses A - mref", used.id, "published")
      await createArticle("Bulk Uses B - mref", alsoUsed.id, "published")

      const result = await payload.delete({
        collection: "media",
        where: { id: { in: [used.id, alsoUsed.id, unused.id] } },
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
      })

      expect(result.docs.map((doc) => doc.id)).toEqual([unused.id])
      expect(result.errors.map((error) => error.id).sort()).toEqual([used.id, alsoUsed.id].sort())
    })

    it("deletes media in use when the delete says to clear it, as the seed does", async () => {
      const media = await createMedia("Seed Clears - mref")
      await createArticle("Seed Clears Article - mref", media.id, "published")

      await expect(
        payload.delete({
          collection: "media",
          id: media.id,
          overrideAccess: true,
          context: { disableRevalidate: true, [DELETE_MEDIA_IN_USE]: true },
        }),
      ).resolves.toMatchObject({ id: media.id })
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

  describe("detach endpoint", () => {
    const callDetach = (user: User, mediaId: number, body: Record<string, unknown>) =>
      detachHandler({
        user,
        payload,
        routeParams: { id: String(mediaId) },
        context: { disableRevalidate: true },
        json: () => Promise.resolve(body),
      } as unknown as PayloadRequest)

    const referencesTo = async (mediaId: number) =>
      (await callReferences(editor, mediaId).then((r) => r.json())) as {
        references: { collection: string; docId: number; field: string }[]
      }

    it("detaches the hero image, then the SEO image, after which the media deletes", async () => {
      const media = await createMedia("Detach Hero - mref")
      const article = await createArticle("Detach Hero Article - mref", media.id, "published")
      const target = { collection: "articles", docId: article.id }

      const afterHero = await callDetach(editor, media.id, { ...target, field: "heroImage" })
      expect(afterHero.status).toBe(200)
      // The SEO image was filled in from the hero image when the article was saved.
      expect((await afterHero.json()).references).toEqual([
        expect.objectContaining({ docId: article.id, field: "meta.image" }),
      ])

      const afterSeo = await callDetach(editor, media.id, { ...target, field: "meta.image" })
      expect(afterSeo.status).toBe(200)
      expect((await afterSeo.json()).references).toEqual([])

      const saved = await payload.findByID({ collection: "articles", id: article.id, depth: 0 })
      expect(saved).toMatchObject({ heroImage: null, _status: "published" })
      expect(saved.meta?.image ?? null).toBeNull()
      await expect(deleteAsEditor(media.id)).resolves.toMatchObject({ id: media.id })
    })

    it("explains that the SEO image refills from the hero image", async () => {
      const media = await createMedia("Detach Seo First - mref")
      const article = await createArticle("Detach Seo First Article - mref", media.id, "published")

      const response = await callDetach(editor, media.id, {
        collection: "articles",
        docId: article.id,
        field: "meta.image",
      })

      expect(response.status).toBe(409)
      expect((await response.json()).error).toContain("Detach that one first")
    })

    it("removes a media block from an article's content and publishes it", async () => {
      const media = await createMedia("Detach Block - mref")
      const other = await createMedia("Detach Block Other - mref")
      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Detach Block Article - mref",
          heroImage: other.id,
          _status: "published",
          content: {
            root: {
              ...ARTICLE_CONTENT.root,
              children: [
                ...ARTICLE_CONTENT.root.children,
                {
                  type: "block",
                  version: 2,
                  format: "",
                  fields: {
                    id: "mref-block",
                    blockName: "",
                    blockType: "mediaBlock",
                    media: media.id,
                  },
                },
              ],
            },
          },
        } as unknown as Article,
      })
      expect((await referencesTo(media.id)).references).toHaveLength(1)

      const response = await callDetach(editor, media.id, {
        collection: "articles",
        docId: article.id,
        field: "content (mediaBlock)",
      })

      expect(response.status).toBe(200)
      expect((await response.json()).references).toEqual([])
      const saved = await payload.findByID({ collection: "articles", id: article.id, depth: 0 })
      expect(JSON.stringify(saved.content)).not.toContain('"mediaBlock"')
      expect(JSON.stringify(saved.content)).toContain("Test content")
    })

    it("refuses to publish over unpublished changes", async () => {
      const media = await createMedia("Detach Pending Draft - mref")
      const article = await createArticle(
        "Detach Pending Draft Article - mref",
        media.id,
        "published",
      )
      await payload.update({
        collection: "articles",
        id: article.id,
        draft: true,
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: { title: "Detach Pending Draft Article (edited) - mref" },
      })

      const response = await callDetach(editor, media.id, {
        collection: "articles",
        docId: article.id,
        field: "heroImage",
      })

      expect(response.status).toBe(409)
      const live = await payload.findByID({ collection: "articles", id: article.id, depth: 0 })
      expect(live.heroImage).toBe(media.id)
    })

    it("refuses a writer, who can't publish", async () => {
      const writer = await createUser("writer")
      const media = await createMedia("Detach Writer - mref")
      const article = await createArticle("Detach Writer Article - mref", media.id, "published")

      const response = await callDetach(writer, media.id, {
        collection: "articles",
        docId: article.id,
        field: "heroImage",
      })

      expect(response.status).toBe(403)
      const live = await payload.findByID({ collection: "articles", id: article.id, depth: 0 })
      expect(live.heroImage).toBe(media.id)
    })
  })
})
