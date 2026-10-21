import { randomUUID } from "node:crypto"
import type { CollectionSlug, Payload } from "payload"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { COLLECTION_PATHS } from "@/utilities/routes"

import { ARTICLE_CONTENT } from "./fixtures/content"
import { createArticle, createVolume } from "./helpers/content"
import { createUser, getPayload } from "./helpers/testUsers"

// Each content collection readers see, driven through an editor's whole session with
// Payload's real versions: an autosave, its publish, a slug changed in drafts and then
// published, an unpublish and a delete. Each step must revalidate what readers would see
// change, and nothing when they wouldn't, so a hook that compares against the autosaved
// draft (Payload's `previousDoc`) or isn't registered fails here.
const { revalidatePath, revalidateTag, purgeEdgeCache } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  purgeEdgeCache: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))

/** Every path the step purged from the edge. */
const purged = (): string[] =>
  purgeEdgeCache.mock.calls.flatMap(([, , options]) => options?.paths ?? [])

const clear = (): void => {
  revalidatePath.mockClear()
  revalidateTag.mockClear()
  purgeEdgeCache.mockClear()
}

interface Subject {
  collection: Extract<CollectionSlug, "articles" | "pages" | "volumes" | "docs">
  create: () => Promise<{ id: number; slug?: string | null }>
  /** A field an editor types into. */
  edit: Record<string, unknown>
  /** The path readers find a slug at. */
  path: (slug: string) => string
  /** Whether the prerendered home page can list it, so publishing it revalidates `/`. */
  onHome?: boolean
}

let payload: Payload
let author: number

beforeAll(async () => {
  payload = await getPayload()
  author = (await createUser("writer")).id
})

beforeEach(clear)

const SUBJECTS: Subject[] = [
  {
    collection: "articles",
    create: () => createArticle({ authors: [author] }),
    edit: { title: "Typed into" },
    path: (slug) => `/articles/${slug}`,
    onHome: true,
  },
  {
    collection: "pages",
    create: () =>
      payload.create({
        collection: "pages",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Sequence page",
          slug: `sequence-page-${randomUUID().slice(0, 8)}`,
          layout: [
            { blockType: "content", columns: [{ size: "full", richText: ARTICLE_CONTENT }] },
          ],
          _status: "published",
        } as never,
      }),
    edit: { title: "Typed into" },
    path: (slug) => `/${slug}`,
  },
  {
    collection: "volumes",
    create: () => createVolume(),
    edit: { description: "Typed into" },
    path: (slug) => `/volumes/${slug}`,
    onHome: true,
  },
  {
    collection: "docs",
    create: () =>
      payload.create({
        collection: "docs",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Sequence doc",
          slug: `sequence-doc-${randomUUID().slice(0, 8)}`,
          summary: "A doc for the save-sequence test.",
          content: ARTICLE_CONTENT,
          publishedAt: new Date().toISOString(),
          _status: "published",
        } as never,
      }),
    edit: { summary: "Typed into" },
    // Every docs page shows the whole tree, so a save refreshes them all under /docs.
    path: () => "/docs",
  },
]

describe.each(SUBJECTS)("an editor's session on $collection", (subject) => {
  it("revalidates only what readers would see change, at each step", async () => {
    const created = await subject.create()
    const slug = created.slug!
    const save = (data: Record<string, unknown>, draft: boolean) =>
      payload.update({
        collection: subject.collection,
        id: created.id,
        overrideAccess: true,
        draft,
        data,
      })

    // Typing autosaves a draft over the published copy: readers see nothing new.
    await save(subject.edit, true)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()

    // Publishing it changes the page readers have.
    await save({ ...subject.edit, _status: "published" }, false)
    expect(revalidatePath).toHaveBeenCalledWith(subject.path(slug))
    expect(purged()).toContain(subject.path(slug))
    if (subject.onHome) expect(revalidatePath).toHaveBeenCalledWith("/")
    else expect(revalidatePath).not.toHaveBeenCalledWith("/")

    // A slug changed in drafts moves nothing until it's published, then moves both URLs.
    clear()
    const renamed = `${slug}-renamed`
    await save({ slug: renamed }, true)
    expect(purgeEdgeCache).not.toHaveBeenCalled()
    await save({ slug: renamed, _status: "published" }, false)
    expect(revalidatePath).toHaveBeenCalledWith(subject.path(renamed))
    expect(revalidatePath).toHaveBeenCalledWith(subject.path(slug))

    // Unpublishing takes the page away.
    clear()
    await save({ _status: "draft" }, false)
    expect(revalidatePath).toHaveBeenCalledWith(subject.path(renamed))
    expect(purged()).toContain(subject.path(renamed))

    // Deleting it purges its last URL again.
    clear()
    await payload.delete({ collection: subject.collection, id: created.id, overrideAccess: true })
    expect(purged()).toContain(subject.path(renamed))
  })
})

describe("topics and media", () => {
  it("revalidates a topic's articles when its name changes", async () => {
    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { name: `Sequence topic ${randomUUID().slice(0, 8)}` } as never,
    })
    const article = await createArticle({ authors: [author] })
    await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { topics: [topic.id] } as never,
    })

    await payload.update({
      collection: "topics",
      id: topic.id,
      overrideAccess: true,
      data: { name: `${topic.name} renamed` } as never,
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/articles/${article.slug}`)
    expect(purged()).toContain(`/topics/${topic.slug}`)

    clear()
    await payload.delete({ collection: "topics", id: topic.id, overrideAccess: true })
    expect(revalidatePath).toHaveBeenCalledWith(`/articles/${article.slug}`)
  })
})

describe("every collection with a public page", () => {
  it("revalidates on change and delete, and compares drafts with readers' copy", () => {
    const revalidates = (hooks: { name: string }[] = []) =>
      hooks.some((hook) => hook.name.startsWith("revalidate"))
    for (const slug of Object.keys(COLLECTION_PATHS)) {
      const collection = payload.collections[slug as CollectionSlug]!.config
      expect(revalidates(collection.hooks.afterChange), `${slug} has no revalidate hook`).toBe(true)
      expect(
        revalidates(collection.hooks.afterDelete),
        `${slug} has no revalidate hook on delete`,
      ).toBe(true)
      if (collection.versions?.drafts) {
        const beforeChange = collection.hooks.beforeChange ?? []
        expect(
          beforeChange.some((hook) => hook.name === "rememberReadersCopy"),
          `${slug} has drafts but no rememberReadersCopy`,
        ).toBe(true)
      }
    }
  })
})
