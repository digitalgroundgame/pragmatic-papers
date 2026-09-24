import { beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"
import type { Article, Page, Volume } from "@/payload-types"
import { getPayload } from "./helpers/testUsers"
import { ARTICLE_CONTENT } from "./fixtures/content"

// Payload 3.90.2 made slugField's generateSlug hook assign the slug after an
// await, so the required `slug` sibling validated first and every create
// without a slug failed with "Slug: This field is required." Pin the
// generated slugs directly so a regression names itself here.
describe("slugField generation on create", () => {
  let payload: Payload
  const ctx = { disableRevalidate: true }

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("derives an article slug from its title", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test: The Written Word",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    expect(article.slug).toBe("slug-test-the-written-word")
  })

  it("keeps a slug the author set explicitly", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test Explicit",
        slug: "hand-picked-slug",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    expect(article.slug).toBe("hand-picked-slug")
  })

  it("derives a page slug from its title", async () => {
    const page = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test About Us",
        hero: { type: "lowImpact" },
        layout: [{ blockType: "content", columns: [{ size: "full", richText: ARTICLE_CONTENT }] }],
        _status: "draft",
      } as unknown as Page,
    })

    expect(page.slug).toBe("slug-test-about-us")
  })

  it("derives a topic slug from its name", async () => {
    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Slug Test Foreign Policy" },
    })

    expect(topic.slug).toBe("slug-test-foreign-policy")
  })

  it("derives a volume slug from its number through the custom slugify", async () => {
    const volume = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test Volume",
        description: "Slug test volume",
        volumeNumber: 901,
        _status: "draft",
      } as unknown as Volume,
    })

    expect(volume.slug).toBe("901")
  })
})
