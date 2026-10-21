import { randomUUID } from "node:crypto"
import type { Payload } from "payload"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { embedKey } from "@/blocks/SocialEmbed/helpers/embedKey"
import { SOCIAL_EMBED_SNAPSHOT_TTL_MS } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import { refreshEmbedSnapshots } from "@/jobs/refreshEmbedSnapshots/logic"
import type { Article, User } from "@/payload-types"

import { createUser, getPayload } from "./helpers/testUsers"

let payload: Payload
let writer: User
const articles: number[] = []
const keys: string[] = []
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

beforeAll(async () => {
  payload = await getPayload()
  writer = await createUser("writer")
})

afterEach(async () => {
  if (articles.length) {
    await payload.delete({
      collection: "articles",
      where: { id: { in: articles.splice(0) } },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }
  if (keys.length) {
    await payload.delete({
      collection: "embed-snapshots",
      where: { key: { in: keys.splice(0) } },
      overrideAccess: true,
    })
  }
})

const stale = () => new Date(Date.now() - SOCIAL_EMBED_SNAPSHOT_TTL_MS - 60_000).toISOString()

/** A published article embedding one tweet, saved with an `ok` snapshot past its TTL. */
async function publishArticleWithTweet(): Promise<{ article: Article; url: string }> {
  const url = `https://x.com/pragmatic/status/${Date.now()}${Math.floor(Math.random() * 1e6)}`
  keys.push(embedKey({ platform: "twitter", url }))
  const article = await payload.create({
    collection: "articles",
    overrideAccess: true,
    // The save hook would fetch the tweet; keep the stale snapshot this test sets.
    context: { disableRevalidate: true, skipSocialEmbedSnapshot: true },
    data: {
      title: `Embed refresh ${randomUUID().slice(0, 8)}`,
      authors: [writer.id],
      _status: "published",
      content: {
        root: {
          type: "root",
          version: 1,
          direction: null,
          format: "",
          indent: 0,
          children: [
            {
              type: "block",
              version: 2,
              format: "",
              fields: {
                id: randomUUID().replace(/-/g, "").slice(0, 24),
                blockName: "",
                blockType: "socialEmbed",
                url,
                snapshot: { status: "ok", fetchedAt: stale(), html: "<p>saved tweet</p>" },
              },
            },
          ],
        },
      },
    } as unknown as Article,
  })
  articles.push(article.id)
  return { article, url }
}

const removed = vi.fn(async ({ snapshot }) => ({
  ...snapshot,
  status: "not_found" as const,
  fetchedAt: new Date().toISOString(),
}))

describe("refreshEmbedSnapshots", () => {
  it("stores the refetch in embed-snapshots and leaves the article and its versions alone", async () => {
    const { article, url } = await publishArticleWithTweet()
    const versionsBefore = await payload.countVersions({
      collection: "articles",
      where: { parent: { equals: article.id } },
    })

    const counts = await refreshEmbedSnapshots(payload, { log, build: removed })
    expect(counts.refreshed).toBeGreaterThanOrEqual(1)

    const { docs } = await payload.find({
      collection: "embed-snapshots",
      where: { key: { equals: embedKey({ platform: "twitter", url }) } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      url,
      platform: "twitter",
      snapshot: { status: "not_found", html: "<p>saved tweet</p>" },
    })

    const after = await payload.findByID({ collection: "articles", id: article.id, depth: 0 })
    expect(after.updatedAt).toBe(article.updatedAt)
    await expect(
      payload.countVersions({ collection: "articles", where: { parent: { equals: article.id } } }),
    ).resolves.toEqual(versionsBefore)
  })

  it("keeps an editor's newer draft as the article's latest version", async () => {
    const { article } = await publishArticleWithTweet()
    await payload.update({
      collection: "articles",
      id: article.id,
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true, skipSocialEmbedSnapshot: true },
      data: { title: "Draft in progress" },
    })

    await refreshEmbedSnapshots(payload, { log, build: removed })

    const latest = await payload.findByID({
      collection: "articles",
      id: article.id,
      draft: true,
      depth: 0,
    })
    expect(latest.title).toBe("Draft in progress")
    const published = await payload.findByID({ collection: "articles", id: article.id, depth: 0 })
    expect(published.title).toBe(article.title)
  })

  it("leaves the embed alone on the next run, now that its refresh is fresh", async () => {
    const { url } = await publishArticleWithTweet()
    await refreshEmbedSnapshots(payload, { log, build: removed })
    removed.mockClear()

    await refreshEmbedSnapshots(payload, { log, build: removed })
    expect(removed).not.toHaveBeenCalledWith(expect.objectContaining({ url }))
  })
})
