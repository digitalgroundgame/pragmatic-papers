import { randomUUID } from "node:crypto"
import type { Article, User } from "@/payload-types"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import {
  querySyndicatedArticleBySlug,
  querySyndicatedArticles,
} from "@/app/(frontend)/feed.substack/queries"
import * as articleRoute from "@/app/(frontend)/feed.substack/[slug]/route"
import * as feedRoute from "@/app/(frontend)/feed.substack/route"
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
