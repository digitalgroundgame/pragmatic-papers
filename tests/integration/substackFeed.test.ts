import { randomUUID } from "node:crypto"
import type { Article, User } from "@/payload-types"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import {
  querySyndicatedArticleBySlug,
  querySyndicatedArticles,
} from "@/app/(frontend)/articles/_substack/queries"
import * as articleRoute from "@/app/(frontend)/articles/[slug]/substack.xml/route"
import * as feedRoute from "@/app/(frontend)/articles/substack.xml/route"
import { ARTICLE_CONTENT } from "./fixtures/content"
import { createUser, getPayload } from "./helpers/testUsers"

let payload: Payload
let editor: User
let writer: User

const uniqueSlug = (label: string) => `substack-${label}-${randomUUID().slice(0, 8)}`

/** Creates an article directly, as seeding would (no access checks). */
const seedArticle = (label: string, data: Partial<Article>) =>
  payload.create({
    collection: "articles",
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: {
      title: `Substack ${label}`,
      slug: uniqueSlug(label),
      generateSlug: false,
      content: ARTICLE_CONTENT,
      ...data,
    } as unknown as Article,
  })

beforeAll(async () => {
  payload = await getPayload()
  editor = await createUser("editor")
  writer = await createUser("writer")
})

describe("Substack feed queries", () => {
  let syndicated: Article
  let notSyndicated: Article
  let draft: Article

  beforeAll(async () => {
    syndicated = await seedArticle("syndicated", {
      _status: "published",
      syndicateToSubstack: true,
    })
    notSyndicated = await seedArticle("not-syndicated", {
      _status: "published",
      syndicateToSubstack: false,
    })
    draft = await seedArticle("draft", { _status: "draft", syndicateToSubstack: true })
  })

  it("lists only published articles that are syndicated", async () => {
    const slugs = (await querySyndicatedArticles()).map(({ slug }) => slug)

    expect(slugs).toContain(syndicated.slug)
    expect(slugs).not.toContain(notSyndicated.slug)
    expect(slugs).not.toContain(draft.slug)
  })

  it("finds a syndicated article by slug", async () => {
    await expect(querySyndicatedArticleBySlug(syndicated.slug)).resolves.toMatchObject({
      id: syndicated.id,
    })
  })

  it.each([
    ["not syndicated", () => notSyndicated.slug],
    ["a draft", () => draft.slug],
    ["missing", () => "no-such-article"],
  ])("finds nothing by slug when the article is %s", async (_label, getSlug) => {
    await expect(querySyndicatedArticleBySlug(getSlug())).resolves.toBeNull()
  })

  it("serves the syndicated article in both feeds", async () => {
    const feed = await (await feedRoute.GET()).text()
    expect(feed).toContain(`/articles/${syndicated.slug}</link>`)
    expect(feed).not.toContain(`/articles/${notSyndicated.slug}</link>`)
    expect(feed).not.toContain(`/articles/${draft.slug}</link>`)

    const single = await articleRoute.GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: syndicated.slug }),
    })
    expect(single.status).toBe(200)
    expect(await single.text()).toContain(`/articles/${syndicated.slug}</link>`)
  })

  it("leaves an imported article out of the bulk feed and keeps its own feed", async () => {
    const imported = await seedArticle("imported", {
      _status: "published",
      syndicateToSubstack: true,
      substackUrl: "https://thepragmaticpapers.substack.com/p/imported",
    })
    // Clearing the field in the admin can save an empty string, which isn't an import.
    const cleared = await seedArticle("cleared", {
      _status: "published",
      syndicateToSubstack: true,
      substackUrl: "",
    })

    const slugs = (await querySyndicatedArticles()).map(({ slug }) => slug)
    expect(slugs).not.toContain(imported.slug)
    expect(slugs).toContain(cleared.slug)
    expect(slugs).toContain(syndicated.slug)

    const single = await articleRoute.GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: imported.slug }),
    })
    expect(single.status).toBe(200)
    expect(await single.text()).toContain(`/articles/${imported.slug}</link>`)
  })

  it("returns 404 from the single-article feed for an article that isn't syndicated", async () => {
    const response = await articleRoute.GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: notSyndicated.slug }),
    })
    expect(response.status).toBe(404)
  })
})

describe("syndicateToSubstack field access", () => {
  const create = (user: User, label: string) =>
    payload.create({
      collection: "articles",
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
      data: {
        title: `Substack access ${label}`,
        slug: uniqueSlug(label),
        generateSlug: false,
        content: ARTICLE_CONTENT,
        _status: "draft",
        syndicateToSubstack: true,
      } as unknown as Article,
    })

  const setSyndicated = (user: User, id: Article["id"]) =>
    payload.update({
      collection: "articles",
      id,
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
      data: { syndicateToSubstack: true },
    })

  it("lets an editor tick it when creating an article", async () => {
    const article = await create(editor, "editor-create")
    expect(article.syndicateToSubstack).toBe(true)
  })

  it("ignores it when a writer creates an article", async () => {
    const article = await create(writer, "writer-create")
    expect(article.syndicateToSubstack).toBe(false)
  })

  it("lets an editor tick it on an existing article", async () => {
    const article = await seedArticle("editor-update", { _status: "draft" })
    const updated = await setSyndicated(editor, article.id)
    expect(updated.syndicateToSubstack).toBe(true)
  })

  it("ignores it when a writer updates their own draft", async () => {
    const article = await create(writer, "writer-update")
    const updated = await setSyndicated(writer, article.id)
    expect(updated.syndicateToSubstack).toBe(false)
  })
})

describe("substackUrl field", () => {
  const substackUrl = "https://thepragmaticpapers.substack.com/p/an-article"

  const setUrl = (user: User, id: Article["id"], value: string | null) =>
    payload.update({
      collection: "articles",
      id,
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
      data: { substackUrl: value },
    })

  it("lets an editor record the post, trimmed", async () => {
    const article = await seedArticle("url-editor", { _status: "draft", syndicateToSubstack: true })
    const updated = await setUrl(editor, article.id, `  ${substackUrl} `)
    expect(updated.substackUrl).toBe(substackUrl)
  })

  it("ignores it when a writer updates their own draft", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: false,
      user: writer,
      context: { disableRevalidate: true },
      data: {
        title: "Substack url writer",
        slug: uniqueSlug("url-writer"),
        generateSlug: false,
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })
    const updated = await setUrl(writer, article.id, substackUrl)
    expect(updated.substackUrl ?? null).toBeNull()
  })

  it("refuses an address that isn't on Substack on a published article", async () => {
    // Payload validates a field on publish (a draft save skips it), and only while its
    // admin condition holds, so the article is syndicated.
    const article = await seedArticle("url-invalid", {
      _status: "published",
      syndicateToSubstack: true,
    })
    await expect(
      setUrl(editor, article.id, "https://example.org/p/an-article"),
    ).rejects.toMatchObject({ name: "ValidationError" })
  })

  it("keeps the address through a save that doesn't send it, and clears it to null", async () => {
    const article = await seedArticle("url-keep", { _status: "draft", substackUrl })

    const retitled = await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: false,
      user: editor,
      context: { disableRevalidate: true },
      data: { title: "Substack url kept" },
    })
    expect(retitled.substackUrl).toBe(substackUrl)

    const cleared = await setUrl(editor, article.id, "  ")
    expect(cleared.substackUrl).toBeNull()
  })
})
