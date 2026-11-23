import { beforeAll, describe, expect, it } from "vitest"
import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres"
import type { Payload } from "payload"
import type { Article, Interactive, Page, Volume } from "@/payload-types"
import { createUser, getPayload } from "./helpers/testUsers"
import { ARTICLE_CONTENT } from "./fixtures/content"
import { up as untickGenerateSlug } from "@/migrations/20261122_235342_untick_generate_slug"

// Payload's slugField generates the slug in a hook on its hidden `generateSlug` checkbox, and
// while the box is ticked it re-slugs from the title on every update. Pin both halves: slugs
// are generated on create, and a published document's slug survives a rename.
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

  it("derives the slug of an article published on create", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test Published On Create",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })

    expect(article.slug).toBe("slug-test-published-on-create")
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

  it("derives an interactive slug from its title", async () => {
    const interactive = await payload.create({
      collection: "interactives",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test Interactive",
        profile: "federal-courts",
        _status: "draft",
      } as unknown as Interactive,
    })

    expect(interactive.slug).toBe("slug-test-interactive")
  })

  // The admin's autosave creates an article on the first change, which can come
  // before a title (a hero image, an author). Without a slug the draft has no Preview button.
  it("fills an empty slug once a draft started without a title gets one", async () => {
    const writer = await createUser("writer")
    const started = await payload.create({
      collection: "articles",
      overrideAccess: false,
      user: writer,
      draft: true,
      context: ctx,
      data: { _status: "draft" } as unknown as Article,
    })
    expect(started.slug).toBeFalsy()

    const latest = await payload.findByID({
      collection: "articles",
      id: started.id,
      draft: true,
      depth: 0,
    })
    const titled = await payload.update({
      collection: "articles",
      id: started.id,
      overrideAccess: false,
      user: writer,
      draft: true,
      autosave: true,
      context: ctx,
      data: { ...latest, title: "Slug Test Titled Later", _status: "draft" },
    })

    expect(titled.slug).toBe("slug-test-titled-later")
  })

  it("leaves a published article's slug alone when the title changes", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test Before Rename",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })

    const renamed = await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      draft: true,
      context: ctx,
      data: { title: "Slug Test After Rename", _status: "draft" },
    })
    expect(renamed.slug).toBe("slug-test-before-rename")

    const republished = await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      context: ctx,
      data: { title: "Slug Test After Rename", _status: "published" },
    })
    expect(republished.slug).toBe("slug-test-before-rename")
  })

  // Rows from before Payload unticked the box on publish still had it ticked, until the
  // untick_generate_slug migration.
  it("keeps the slug of a document the migration unticked", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: ctx,
      data: {
        title: "Slug Test Legacy Row",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })
    await payload.db.drizzle.execute(
      sql`UPDATE "articles" SET "generate_slug" = true WHERE "id" = ${article.id}`,
    )
    await payload.db.drizzle.execute(
      sql`UPDATE "_articles_v" SET "version_generate_slug" = true WHERE "parent_id" = ${article.id}`,
    )

    await untickGenerateSlug({ db: payload.db.drizzle, payload } as unknown as MigrateUpArgs)

    const renamed = await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      context: ctx,
      data: { title: "Slug Test Legacy Renamed", _status: "published" },
    })
    expect(renamed.slug).toBe("slug-test-legacy-row")
  })

  it("renames a user without changing their slug", async () => {
    const user = await createUser("writer")
    await payload.db.drizzle.execute(
      sql`UPDATE "users" SET "generate_slug" = true WHERE "id" = ${user.id}`,
    )
    await untickGenerateSlug({ db: payload.db.drizzle, payload } as unknown as MigrateUpArgs)

    const renamed = await payload.update({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      context: ctx,
      data: { name: "Someone Else Entirely" },
    })
    expect(renamed.slug).toBe(user.slug)
  })
})
