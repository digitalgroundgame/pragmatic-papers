// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

import { SOCIAL_EMBED_SNAPSHOT_TTL_MS } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import { embedKey } from "@/blocks/SocialEmbed/helpers/embedKey"
import type { SocialEmbedSnapshot } from "@/payload-types"

import { collectEmbeds, refreshEmbedSnapshots } from "../logic"

const NOW = new Date("2026-06-01T00:00:00Z")
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const STALE = ago(SOCIAL_EMBED_SNAPSHOT_TTL_MS + 1000)
const FRESH = ago(1000)

const embed = (url: string, snapshot: SocialEmbedSnapshot = {}) => ({
  type: "block",
  version: 2,
  fields: { id: url, blockType: "socialEmbed", platform: "twitter", url, snapshot },
})
const content = (...children: unknown[]) => ({ root: { type: "root", version: 1, children } })

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const build = vi.fn()

function fakePayload({ articles = [] as unknown[], rows = [] as Record<string, unknown>[] } = {}) {
  const find = vi.fn(async ({ collection }: { collection: string }) => ({
    docs: collection === "articles" ? articles.map((c, id) => ({ id, content: c })) : rows,
  }))
  const create = vi.fn()
  const update = vi.fn()
  return { find, create, update, payload: { find, create, update } as unknown as Payload }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  build.mockImplementation(async ({ snapshot }) => ({
    ...snapshot,
    status: "not_found",
    fetchedAt: NOW.toISOString(),
  }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("collectEmbeds", () => {
  it("finds Social Embed blocks at any depth and skips other blocks", () => {
    const nested = { type: "quote", children: [embed("https://x.com/a/status/2")] }
    const other = { type: "block", fields: { blockType: "banner", url: "https://x.com" } }
    const found = collectEmbeds(content(embed("https://x.com/a/status/1"), nested, other))
    expect(found.map((block) => block.url)).toEqual([
      "https://x.com/a/status/1",
      "https://x.com/a/status/2",
    ])
  })

  it("skips a block with no URL or platform yet", () => {
    const blank = { type: "block", fields: { blockType: "socialEmbed", url: "" } }
    expect(
      collectEmbeds(content({ ...blank, fields: { ...blank.fields, url: undefined } })),
    ).toEqual([])
  })

  it("returns nothing for empty content", () => {
    expect(collectEmbeds(null)).toEqual([])
    expect(collectEmbeds(undefined)).toEqual([])
  })
})

describe("refreshEmbedSnapshots", () => {
  it("reads only published articles", async () => {
    const { payload, find } = fakePayload()
    await refreshEmbedSnapshots(payload, { log, build })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        draft: false,
        where: { _status: { equals: "published" } },
      }),
    )
  })

  it("stores a refetch of a stale embed in embed-snapshots and never writes the article", async () => {
    const url = "https://x.com/a/status/1"
    const { payload, create, update } = fakePayload({
      articles: [content(embed(url, { status: "ok", fetchedAt: STALE, html: "<p>saved</p>" }))],
    })
    const counts = await refreshEmbedSnapshots(payload, { log, build })

    expect(counts).toEqual({ refreshed: 1, fresh: 0, failed: 0 })
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "twitter",
        url,
        snapshot: expect.objectContaining({ html: "<p>saved</p>" }),
      }),
    )
    expect(create).toHaveBeenCalledWith({
      collection: "embed-snapshots",
      overrideAccess: true,
      data: expect.objectContaining({
        key: embedKey({ platform: "twitter", url }),
        url,
        snapshot: expect.objectContaining({ status: "not_found", html: "<p>saved</p>" }),
      }),
    })
    expect(update).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledWith(`[embed-refresh] ${url} is now not_found`)
  })

  it("updates the existing row rather than adding another", async () => {
    const url = "https://x.com/a/status/1"
    const key = embedKey({ platform: "twitter", url })
    const { payload, create, update } = fakePayload({
      articles: [content(embed(url, { status: "ok", fetchedAt: STALE }))],
      rows: [
        {
          id: 7,
          key,
          snapshot: { status: "ok", fetchedAt: ago(SOCIAL_EMBED_SNAPSHOT_TTL_MS * 1.5) },
        },
      ],
    })
    await refreshEmbedSnapshots(payload, { log, build })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "embed-snapshots", id: 7 }),
    )
    expect(create).not.toHaveBeenCalled()
  })

  it("leaves an embed alone while its saved or refreshed snapshot is fresh", async () => {
    const saved = "https://x.com/a/status/1"
    const refreshed = "https://x.com/a/status/2"
    const { payload, create, update } = fakePayload({
      articles: [
        content(
          embed(saved, { status: "ok", fetchedAt: FRESH }),
          embed(refreshed, { status: "ok", fetchedAt: STALE }),
        ),
      ],
      rows: [
        {
          id: 1,
          key: embedKey({ platform: "twitter", url: refreshed }),
          snapshot: { status: "ok", fetchedAt: FRESH },
        },
      ],
    })
    const counts = await refreshEmbedSnapshots(payload, { log, build })
    expect(counts).toEqual({ refreshed: 0, fresh: 2, failed: 0 })
    expect(build).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("doesn't retry a post that already failed to fetch", async () => {
    const { payload } = fakePayload({
      articles: [
        content(embed("https://x.com/a/status/1", { status: "not_found", fetchedAt: STALE })),
      ],
    })
    expect(await refreshEmbedSnapshots(payload, { log, build })).toEqual({
      refreshed: 0,
      fresh: 1,
      failed: 0,
    })
  })

  it("fetches a post embedded in two articles once", async () => {
    const block = embed("https://x.com/a/status/1", { status: "ok", fetchedAt: STALE })
    const { payload, create } = fakePayload({ articles: [content(block), content(block)] })
    await refreshEmbedSnapshots(payload, { log, build })
    expect(build).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("counts a failure and carries on with the next embed", async () => {
    const { payload, create } = fakePayload({
      articles: [
        content(
          embed("https://x.com/a/status/1", { status: "ok", fetchedAt: STALE }),
          embed("https://x.com/a/status/2", { status: "ok", fetchedAt: STALE }),
        ),
      ],
    })
    build.mockRejectedValueOnce(new Error("provider down"))
    const counts = await refreshEmbedSnapshots(payload, { log, build })
    expect(counts).toEqual({ refreshed: 1, fresh: 0, failed: 1 })
    expect(create).toHaveBeenCalledTimes(1)
    expect(log.error).toHaveBeenCalledWith(
      "[embed-refresh] https://x.com/a/status/1: provider down",
    )
  })

  it("skips the snapshot lookup when no article embeds anything", async () => {
    const { payload, find } = fakePayload({ articles: [content()] })
    expect(await refreshEmbedSnapshots(payload, { log, build })).toEqual({
      refreshed: 0,
      fresh: 0,
      failed: 0,
    })
    expect(find).toHaveBeenCalledTimes(1)
  })
})
